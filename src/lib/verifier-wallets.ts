import fs from 'fs'
import path from 'path'
import { Redis } from '@upstash/redis'
import { PublicKey } from '@solana/web3.js'

const REGISTRY_PATH = path.join(process.cwd(), '.wallets', 'verifier-registry.json')
const REGISTRY_KEY = 'trustsaur:verifier-wallets'

type Registry = Record<string, string> // telegramUserId -> Solana wallet address

// Vercel's filesystem is read-only outside /tmp and not shared across
// invocations, so production must use Redis. Local dev falls back to the
// gitignored JSON file when Upstash env vars aren't configured.
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function loadRegistryFromFile(): Registry {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveRegistryToFile(registry: Registry) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true })
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2))
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export async function registerVerifierWallet(telegramUserId: number, address: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.hset(REGISTRY_KEY, { [String(telegramUserId)]: address })
    return
  }

  const registry = loadRegistryFromFile()
  registry[String(telegramUserId)] = address
  saveRegistryToFile(registry)
}

export async function getVerifierWallet(telegramUserId: number): Promise<string | undefined> {
  const redis = getRedis()
  if (redis) {
    const address = await redis.hget<string>(REGISTRY_KEY, String(telegramUserId))
    return address ?? undefined
  }

  return loadRegistryFromFile()[String(telegramUserId)]
}
