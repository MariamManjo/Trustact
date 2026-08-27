import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import { createHmac, timingSafeEqual } from 'crypto'

const NOTIFY_PATH = path.join(process.cwd(), '.wallets', 'notify-emails.json')
const NOTIFY_SET_KEY = 'trustsaur:notify:emails'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same Redis-with-file-fallback shape used across this app's lib files.
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function loadFileStore(): string[] {
  try {
    return JSON.parse(fs.readFileSync(NOTIFY_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function saveFileStore(emails: string[]) {
  fs.mkdirSync(path.dirname(NOTIFY_PATH), { recursive: true })
  fs.writeFileSync(NOTIFY_PATH, JSON.stringify(emails, null, 2))
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export async function subscribeEmail(email: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.sadd(NOTIFY_SET_KEY, email)
    return
  }

  const emails = loadFileStore()
  if (!emails.includes(email)) {
    saveFileStore([...emails, email])
  }
}

export async function unsubscribeEmail(email: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.srem(NOTIFY_SET_KEY, email)
    return
  }

  saveFileStore(loadFileStore().filter((e) => e !== email))
}

export async function listSubscribedEmails(): Promise<string[]> {
  const redis = getRedis()
  if (redis) {
    return redis.smembers(NOTIFY_SET_KEY)
  }

  return loadFileStore()
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
