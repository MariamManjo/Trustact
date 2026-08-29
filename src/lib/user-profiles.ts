import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'

const PROFILES_PATH = path.join(process.cwd(), '.wallets', 'profiles.json')
const PROFILE_HASH_KEY = 'trustsaur:profiles'

const NICKNAME_PATTERN = /^[a-zA-Z0-9 _-]{1,24}$/

export interface UserProfile {
  wallet: string
  nickname: string | null
  createdAt: number
}

// Same Redis-with-file-fallback shape used across this app's lib files.
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function loadFileStore(): Record<string, UserProfile> {
  try {
    return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveFileStore(store: Record<string, UserProfile>) {
  fs.mkdirSync(path.dirname(PROFILES_PATH), { recursive: true })
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(store, null, 2))
}

export function isValidNickname(nickname: string): boolean {
  return NICKNAME_PATTERN.test(nickname)
}

export async function getProfile(wallet: string): Promise<UserProfile | null> {
  const redis = getRedis()
  if (redis) {
    return (await redis.hget<UserProfile>(PROFILE_HASH_KEY, wallet)) ?? null
  }
  return loadFileStore()[wallet] ?? null
}

/**
 * Creates a profile the first time a wallet signs in — idempotent, never
 * overwrites one that already exists. Called from the Sign-In With Solana
 * flow so every verified wallet has a row from the moment it first connects,
 * not just once it happens to set a nickname.
 */
export async function ensureProfile(wallet: string): Promise<UserProfile> {
  const existing = await getProfile(wallet)
  if (existing) return existing

  const profile: UserProfile = { wallet, nickname: null, createdAt: Date.now() }
  const redis = getRedis()
  if (redis) {
    await redis.hset(PROFILE_HASH_KEY, { [wallet]: profile })
    return profile
  }

  const store = loadFileStore()
  store[wallet] = profile
  saveFileStore(store)
  return profile
}

export async function setNickname(wallet: string, nickname: string | null): Promise<UserProfile> {
  const existing = await getProfile(wallet)
  const updated: UserProfile = { wallet, createdAt: existing?.createdAt ?? Date.now(), nickname }

  const redis = getRedis()
  if (redis) {
    await redis.hset(PROFILE_HASH_KEY, { [wallet]: updated })
    return updated
  }

  const store = loadFileStore()
  store[wallet] = updated
  saveFileStore(store)
  return updated
}

/** Batch lookup so rendering a list of wallets (history, activity feed) doesn't fire one request per row. */
export async function getProfiles(wallets: string[]): Promise<Record<string, UserProfile>> {
  const unique = [...new Set(wallets)]
  if (unique.length === 0) return {}

  const redis = getRedis()
  const map: Record<string, UserProfile> = {}
  if (redis) {
    const results = await Promise.all(unique.map((w) => redis.hget<UserProfile>(PROFILE_HASH_KEY, w)))
    unique.forEach((w, i) => {
      const p = results[i]
      if (p) map[w] = p
    })
    return map
  }

  const store = loadFileStore()
  for (const w of unique) {
    if (store[w]) map[w] = store[w]
  }
  return map
}
