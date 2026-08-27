import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import nacl from 'tweetnacl'
import { PublicKey } from '@solana/web3.js'

const SESSION_PATH = path.join(process.cwd(), '.wallets', 'sessions.json')
const SESSION_KEY_PREFIX = 'trustsaur:session:'
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const MESSAGE_FRESHNESS_MS = 5 * 60 * 1000 // 5 minutes — rejects a captured/replayed old signature

export const SESSION_COOKIE = 'trustact_session'

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

interface FileSession {
  wallet: string
  expiresAt: number
}

function loadFileStore(): Record<string, FileSession> {
  try {
    return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveFileStore(store: Record<string, FileSession>) {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
  fs.writeFileSync(SESSION_PATH, JSON.stringify(store, null, 2))
}

/**
 * Sign-In With Solana message — see WALLET_UX_SPEC.md §2. The "Issued at"
 * line is what makes a signature single-use-ish: the server rejects one
 * older than MESSAGE_FRESHNESS_MS, so a captured signature can't be replayed
 * indefinitely to mint new sessions.
 */
export function buildSignInMessage(wallet: string, issuedAt: string, domain: string): string {
  return `${domain} wants you to sign in with your Solana account:
${wallet}

This proves you control this wallet. It costs nothing and approves no transaction.

Issued at: ${issuedAt}`
}

export function verifySignature(message: string, signature: number[], wallet: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = Uint8Array.from(signature)
    const publicKeyBytes = new PublicKey(wallet).toBytes()
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch {
    return false
  }
}

export function isMessageFresh(issuedAt: string): boolean {
  const issuedMs = Date.parse(issuedAt)
  if (Number.isNaN(issuedMs)) return false
  return Math.abs(Date.now() - issuedMs) <= MESSAGE_FRESHNESS_MS
}

export async function createSession(wallet: string): Promise<string> {
  const sessionId = randomUUID()
  const redis = getRedis()
  if (redis) {
    await redis.set(SESSION_KEY_PREFIX + sessionId, wallet, { ex: SESSION_TTL_SECONDS })
    return sessionId
  }

  const store = loadFileStore()
  store[sessionId] = { wallet, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }
  saveFileStore(store)
  return sessionId
}

export async function getSessionWallet(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null

  const redis = getRedis()
  if (redis) {
    return (await redis.get<string>(SESSION_KEY_PREFIX + sessionId)) ?? null
  }

  const entry = loadFileStore()[sessionId]
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.wallet
}

export async function destroySession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return
  const redis = getRedis()
  if (redis) {
    await redis.del(SESSION_KEY_PREFIX + sessionId)
    return
  }

  const store = loadFileStore()
  delete store[sessionId]
  saveFileStore(store)
}

export { SESSION_TTL_SECONDS }
