import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'

const REPUTATION_PATH = path.join(process.cwd(), '.wallets', 'reputation.json')
const CORRECT_KEY = 'trustsaur:reputation:correct'
const INCORRECT_KEY = 'trustsaur:reputation:incorrect'

export interface Reputation {
  correct: number
  incorrect: number
  accuracy: number // 0-1, 1 if no judged answers yet
}

type FileStore = Record<string, { correct: number; incorrect: number }>

// Same Redis-with-file-fallback shape used across this app's lib files. A wallet's
// reputation only ever grows here — incorrect answers can't claw back
// $PURR already minted (no freeze/burn authority for that), so this counter
// is what gates *future* standing (tiers.ts) instead.
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function loadFileStore(): FileStore {
  try {
    return JSON.parse(fs.readFileSync(REPUTATION_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveFileStore(store: FileStore) {
  fs.mkdirSync(path.dirname(REPUTATION_PATH), { recursive: true })
  fs.writeFileSync(REPUTATION_PATH, JSON.stringify(store, null, 2))
}

function toReputation(correct: number, incorrect: number): Reputation {
  const total = correct + incorrect
  return { correct, incorrect, accuracy: total === 0 ? 1 : correct / total }
}

export async function recordJudgment(wallet: string, correct: boolean): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.hincrby(correct ? CORRECT_KEY : INCORRECT_KEY, wallet, 1)
    return
  }

  const store = loadFileStore()
  const entry = store[wallet] ?? { correct: 0, incorrect: 0 }
  if (correct) entry.correct += 1
  else entry.incorrect += 1
  store[wallet] = entry
  saveFileStore(store)
}

export async function getReputation(wallet: string): Promise<Reputation> {
  const redis = getRedis()
  if (redis) {
    const [correct, incorrect] = await Promise.all([
      redis.hget<number>(CORRECT_KEY, wallet),
      redis.hget<number>(INCORRECT_KEY, wallet),
    ])
    return toReputation(correct ?? 0, incorrect ?? 0)
  }

  const entry = loadFileStore()[wallet]
  return toReputation(entry?.correct ?? 0, entry?.incorrect ?? 0)
}
