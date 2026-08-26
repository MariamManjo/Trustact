import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const ROUNDS_PATH = path.join(process.cwd(), '.wallets', 'verification-rounds.json')
const ROUND_KEY_PREFIX = 'trustsaur:round:'
const OPEN_ROUNDS_SET = 'trustsaur:rounds:open'

export const MAX_VERIFIERS = 5

export type RoundStatus = 'collecting' | 'judging' | 'expired' | 'resolved'

export interface ProofRequirements {
  photoRequired: boolean
  locationRequired: boolean
}

export interface AnswerLocation {
  lat: number
  lng: number
  mapUrl: string
}

export interface AnswerSubmission {
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
  photoUrl?: string
  location?: AnswerLocation
  submittedAt: number
  withinHalfWindow: boolean
  judgment?: 'correct' | 'incorrect'
}

export interface PurrAwardRecord {
  amount: number
  breakdown: {
    base: number
    speedBonus: number
    photoBonus: number
    locationBonus: number
    bonusWinnerBonus: number
  }
}

export interface MultiPaymentResult {
  signature: string
  explorerUrl: string
  totalAmountSol: number
  recipients: { wallet: string; amountSol: number }[]
}

export interface VerificationRound {
  id: string
  action: string
  question: string
  askerWallet?: string
  feeLamports: number
  proofRequirements: ProofRequirements
  windowSeconds: number
  createdAt: number
  closesAt: number
  status: RoundStatus
  answers: AnswerSubmission[]
  bonusWinnerWallet?: string
  payment?: MultiPaymentResult
  purrAwards?: Record<string, PurrAwardRecord>
}

// Same Redis-with-file-fallback shape used across this app's lib files — Vercel's
// filesystem is read-only outside /tmp and not shared across invocations,
// so production must use Redis. Local dev falls back to the gitignored
// JSON file when Upstash env vars aren't configured.
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function loadFileStore(): Record<string, VerificationRound> {
  try {
    return JSON.parse(fs.readFileSync(ROUNDS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveFileStore(store: Record<string, VerificationRound>) {
  fs.mkdirSync(path.dirname(ROUNDS_PATH), { recursive: true })
  fs.writeFileSync(ROUNDS_PATH, JSON.stringify(store, null, 2))
}

async function persistRound(round: VerificationRound): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(ROUND_KEY_PREFIX + round.id, round)
    if (round.status === 'collecting') {
      await redis.sadd(OPEN_ROUNDS_SET, round.id)
    } else {
      await redis.srem(OPEN_ROUNDS_SET, round.id)
    }
    return
  }

  const store = loadFileStore()
  store[round.id] = round
  saveFileStore(store)
}

async function readRound(id: string): Promise<VerificationRound | undefined> {
  const redis = getRedis()
  if (redis) {
    const round = await redis.get<VerificationRound>(ROUND_KEY_PREFIX + id)
    return round ?? undefined
  }

  return loadFileStore()[id]
}

/**
 * Lazily transitions a round out of 'collecting' when it's full or its
 * window has elapsed — there's no cron/worker, so every read re-checks.
 * Persists only when a transition actually happens.
 *
 * Concurrency note: round updates are read-modify-write over the Redis
 * REST API, not a transaction. With a hard 5-answer cap and realistic demo
 * traffic the race window is small and the failure mode benign — an
 * accepted, documented risk, not a silent one.
 */
async function closeIfExpired(round: VerificationRound): Promise<VerificationRound> {
  if (round.status !== 'collecting') return round

  const isFull = round.answers.length >= MAX_VERIFIERS
  const isPastWindow = Date.now() > round.closesAt
  if (!isFull && !isPastWindow) return round

  const updated: VerificationRound = {
    ...round,
    status: isFull || round.answers.length >= 1 ? 'judging' : 'expired',
  }
  await persistRound(updated)
  return updated
}

export async function createRound(params: {
  action: string
  question: string
  askerWallet?: string
  feeLamports: number
  proofRequirements: ProofRequirements
  windowSeconds: number
}): Promise<VerificationRound> {
  const now = Date.now()
  const round: VerificationRound = {
    id: randomUUID(),
    action: params.action,
    question: params.question,
    askerWallet: params.askerWallet,
    feeLamports: params.feeLamports,
    proofRequirements: params.proofRequirements,
    windowSeconds: params.windowSeconds,
    createdAt: now,
    closesAt: now + params.windowSeconds * 1000,
    status: 'collecting',
    answers: [],
  }
  await persistRound(round)
  return round
}

export async function getRound(id: string): Promise<VerificationRound | undefined> {
  const round = await readRound(id)
  if (!round) return undefined
  return closeIfExpired(round)
}

export async function listOpenRounds(): Promise<VerificationRound[]> {
  const redis = getRedis()
  if (redis) {
    const ids = await redis.smembers(OPEN_ROUNDS_SET)
    const rounds = await Promise.all(ids.map((id) => getRound(id)))
    return rounds.filter((r): r is VerificationRound => r !== undefined && r.status === 'collecting')
  }

  const store = loadFileStore()
  const rounds = await Promise.all(Object.values(store).map((r) => closeIfExpired(r)))
  return rounds.filter((r) => r.status === 'collecting')
}

export async function submitAnswer(
  id: string,
  submission: Omit<AnswerSubmission, 'submittedAt' | 'withinHalfWindow'>
): Promise<VerificationRound> {
  const round = await getRound(id)
  if (!round) throw new Error('Round not found.')
  if (round.status !== 'collecting') throw new Error('This round is no longer accepting answers.')
  if (round.answers.some((a) => a.verifierWallet === submission.verifierWallet)) {
    throw new Error('This wallet has already answered this round.')
  }
  if (round.proofRequirements.photoRequired && !submission.photoUrl) {
    throw new Error('This question requires a photo.')
  }
  if (round.proofRequirements.locationRequired && !submission.location) {
    throw new Error('This question requires your location.')
  }

  const now = Date.now()
  const answer: AnswerSubmission = {
    ...submission,
    submittedAt: now,
    withinHalfWindow: now - round.createdAt <= (round.windowSeconds * 1000) / 2,
  }

  const updated: VerificationRound = { ...round, answers: [...round.answers, answer] }
  await persistRound(updated)
  return closeIfExpired(updated)
}

export async function recordJudgments(
  id: string,
  judgments: Record<string, 'correct' | 'incorrect'>,
  bonusWinnerWallet?: string
): Promise<VerificationRound> {
  const round = await getRound(id)
  if (!round) throw new Error('Round not found.')

  const answers = round.answers.map((a) => ({
    ...a,
    judgment: judgments[a.verifierWallet] ?? a.judgment,
  }))

  const updated: VerificationRound = { ...round, answers, bonusWinnerWallet }
  await persistRound(updated)
  return updated
}

export async function cachePayout(
  id: string,
  payment: MultiPaymentResult | null,
  purrAwards: Record<string, PurrAwardRecord>
): Promise<VerificationRound> {
  const round = await getRound(id)
  if (!round) throw new Error('Round not found.')

  const updated: VerificationRound = {
    ...round,
    status: 'resolved',
    payment: payment ?? undefined,
    purrAwards,
  }
  await persistRound(updated)
  return updated
}
