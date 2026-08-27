import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import { createHmac, timingSafeEqual } from 'crypto'

const NOTIFY_PATH = path.join(process.cwd(), '.wallets', 'notify-emails.json')
const NOTIFY_HASH_KEY = 'trustsaur:notify:by-wallet'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same Redis-with-file-fallback shape used across this app's lib files.
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function loadFileStore(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(NOTIFY_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveFileStore(byWallet: Record<string, string>) {
  fs.mkdirSync(path.dirname(NOTIFY_PATH), { recursive: true })
  fs.writeFileSync(NOTIFY_PATH, JSON.stringify(byWallet, null, 2))
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

/** One email per wallet — setting again overwrites the previous value. */
export async function subscribeEmail(wallet: string, email: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.hset(NOTIFY_HASH_KEY, { [wallet]: email })
    return
  }

  const store = loadFileStore()
  store[wallet] = email
  saveFileStore(store)
}

export async function getSubscribedEmail(wallet: string): Promise<string | null> {
  const redis = getRedis()
  if (redis) {
    return (await redis.hget<string>(NOTIFY_HASH_KEY, wallet)) ?? null
  }

  return loadFileStore()[wallet] ?? null
}

export async function unsubscribeWallet(wallet: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.hdel(NOTIFY_HASH_KEY, wallet)
    return
  }

  const store = loadFileStore()
  delete store[wallet]
  saveFileStore(store)
}

/** Unsubscribe-by-email is reached from a clicked email link, where there's no wallet/session — remove every wallet mapped to that address. */
export async function unsubscribeEmail(email: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    const all = (await redis.hgetall<Record<string, string>>(NOTIFY_HASH_KEY)) ?? {}
    const wallets = Object.entries(all)
      .filter(([, e]) => e === email)
      .map(([wallet]) => wallet)
    if (wallets.length > 0) await redis.hdel(NOTIFY_HASH_KEY, ...wallets)
    return
  }

  const store = loadFileStore()
  for (const [wallet, e] of Object.entries(store)) {
    if (e === email) delete store[wallet]
  }
  saveFileStore(store)
}

export async function listSubscribedEmails(): Promise<string[]> {
  const redis = getRedis()
  if (redis) {
    const all = (await redis.hgetall<Record<string, string>>(NOTIFY_HASH_KEY)) ?? {}
    return Object.values(all)
  }

  return Object.values(loadFileStore())
}

/**
 * Unsubscribe links carry a signed token instead of the raw email so nobody
 * can unsubscribe someone else just by guessing their address. Signed with
 * RESEND_API_KEY — private, server-only, already provisioned — rather than
 * introducing a dedicated secret for one low-stakes link.
 */
export function signUnsubscribeToken(email: string): string {
  const secret = process.env.RESEND_API_KEY ?? 'trustact-dev-secret'
  return createHmac('sha256', secret).update(email).digest('hex')
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = signUnsubscribeToken(email)
  const expectedBuf = Buffer.from(expected)
  const tokenBuf = Buffer.from(token)
  if (expectedBuf.length !== tokenBuf.length) return false
  return timingSafeEqual(expectedBuf, tokenBuf)
}
