import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'

const REPUTATION_PATH = path.join(process.cwd(), '.wallets', 'reputation.json')
const CORRECT_KEY = 'trustsaur:reputation:correct'
const INCORRECT_KEY = 'trustsaur:reputation:incorrect'
const POINTS_KEY = 'trustsaur:reputation:points'

export interface Reputation {
  correct: number
  incorrect: number
  accuracy: number // 0-1, 1 if no judged answers yet
  /** Leaderboard number only — not an asset, never minted or transferred. */
  points: number
}

type FileStore = Record<string, { correct: number; incorrect: number; points: number }>

// Same Redis-with-file-fallback shape used across this app's lib files.
function getRedis(): Redis | null {
  // Vercel's Upstash marketplace integration injects KV_REST_API_URL/TOKEN,
  // not the UPSTASH_REDIS_REST_* names Upstash's own docs use — support both.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
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

function toReputation(correct: number, incorrect: number, points: number): Reputation {
  const total = correct + incorrect
  return { correct, incorrect, accuracy: total === 0 ? 1 : correct / total, points }
}

export async function recordJudgment(wallet: string, correct: boolean, pointsAwarded = 0): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.hincrby(correct ? CORRECT_KEY : INCORRECT_KEY, wallet, 1)
    if (pointsAwarded > 0) await redis.hincrby(POINTS_KEY, wallet, pointsAwarded)
    return
  }

  const store = loadFileStore()
  const entry = store[wallet] ?? { correct: 0, incorrect: 0, points: 0 }
  if (correct) entry.correct += 1
  else entry.incorrect += 1
  entry.points = (entry.points ?? 0) + pointsAwarded
  store[wallet] = entry
  saveFileStore(store)
}

export async function getReputation(wallet: string): Promise<Reputation> {
  const redis = getRedis()
  if (redis) {
    const [correct, incorrect, points] = await Promise.all([
      redis.hget<number>(CORRECT_KEY, wallet),
      redis.hget<number>(INCORRECT_KEY, wallet),
      redis.hget<number>(POINTS_KEY, wallet),
    ])
    return toReputation(correct ?? 0, incorrect ?? 0, points ?? 0)
  }

  const entry = loadFileStore()[wallet]
  return toReputation(entry?.correct ?? 0, entry?.incorrect ?? 0, entry?.points ?? 0)
}
