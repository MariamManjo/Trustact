import { Redis } from '@upstash/redis'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'
import type { PointsBreakdown } from './reputation-points'

const ROUNDS_PATH = path.join(process.cwd(), '.wallets', 'verification-rounds.json')
const ROUND_KEY_PREFIX = 'trustsaur:round:'
const OPEN_ROUNDS_SET = 'trustsaur:rounds:open'
const WALLET_ASKED_PREFIX = 'trustsaur:wallet:asked:'
const WALLET_ANSWERED_PREFIX = 'trustsaur:wallet:answered:'
const RECENT_ACTIVITY_ZSET = 'trustsaur:rounds:activity'
const RECENT_ACTIVITY_CAP = 50

export const MAX_VERIFIERS = 5

/**
 * Minimum an asker deposits to open a round — a stand-in for "$1", not a
 * live SOL/USD conversion. Answering is free; this deposit is the whole
 * pool correct answerers split.
 */
export const ASK_FEE_LAMPORTS = 0.02 * LAMPORTS_PER_SOL

/** Cut Trustact keeps from a redistributed (non-unanimous) pool. Never taken on a push or a solo answer. */
export const PLATFORM_CUT_RATE = 0.1

const ROUND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidRoundId(id: string): boolean {
  return ROUND_ID_PATTERN.test(id)
}

export type RoundStatus = 'collecting' | 'judging' | 'settling' | 'expired' | 'resolved'

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

/** How a round's pool was settled, for display and for the pitch-facing "no self-interested judge" claim. */
export type ResolutionKind = 'unanimous' | 'majority' | 'tie' | 'solo' | 'refund'

/** Per-round leaderboard points — not an asset. */
export interface PointsAwardRecord {
  amount: number
  breakdown: PointsBreakdown
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
  askerWallet: string
  /** Lamports the asker actually deposited on-chain — the whole pool correct answerers split. */
  feeLamports: number
  /** On-chain signature of the asker's deposit into this round's vault PDA. */
  depositSignature: string
  proofRequirements: ProofRequirements
  windowSeconds: number
  createdAt: number
  closesAt: number
  status: RoundStatus
  answers: AnswerSubmission[]
  resolutionKind?: ResolutionKind
  payment?: MultiPaymentResult
  points?: Record<string, PointsAwardRecord>
}

/** The asker-funded pool correct answerers split — fixed at deposit time, doesn't grow with answers. */
export function getPoolLamports(round: Pick<VerificationRound, 'feeLamports'>): number {
  return round.feeLamports
}

/**
 * Weight ∝ time remaining in the window when each answer landed — the
 * earlier an answer comes in, the more time was left, the bigger its share
 * of a winning pool. Never zero, so even a last-second answer gets a sliver
 * rather than being fully excluded.
 */
export function computeSpeedWeights(
  answers: Pick<AnswerSubmission, 'verifierWallet' | 'submittedAt'>[],
  round: Pick<VerificationRound, 'createdAt' | 'windowSeconds'>
): Record<string, number> {
  const windowMs = round.windowSeconds * 1000
  const weights: Record<string, number> = {}
  for (const a of answers) {
    const elapsed = a.submittedAt - round.createdAt
    weights[a.verifierWallet] = Math.max(windowMs - elapsed, 1)
  }
  return weights
}

/**
 * Resolves a full set of answers by consensus — no asker, no self-interested
 * judge. Unanimous and single-answer rounds are a push (the full pool splits
 * by speed, no platform cut); an even split with no clear majority is also a
 * push, since there's no principled way to pick a winning side. Only a real
 * majority triggers the 10% cut.
 */
export function computeConsensus(answers: AnswerSubmission[]): {
  judgments: Record<string, 'correct' | 'incorrect'>
  resolutionKind: ResolutionKind
} {
  const judgments: Record<string, 'correct' | 'incorrect'> = {}

  if (answers.length === 1) {
    judgments[answers[0].verifierWallet] = 'correct'
    return { judgments, resolutionKind: 'solo' }
  }

  const yesCount = answers.filter((a) => a.answer === 'yes').length
  const noCount = answers.length - yesCount

  if (yesCount === noCount) {
    for (const a of answers) judgments[a.verifierWallet] = 'correct'
    return { judgments, resolutionKind: 'tie' }
  }

  const majorityAnswer = yesCount > noCount ? 'yes' : 'no'
  for (const a of answers) {
    judgments[a.verifierWallet] = a.answer === majorityAnswer ? 'correct' : 'incorrect'
  }
  const resolutionKind: ResolutionKind = noCount === 0 || yesCount === 0 ? 'unanimous' : 'majority'
  return { judgments, resolutionKind }
}

// Same Redis-with-file-fallback shape used across this app's lib files — Vercel's
// filesystem is read-only outside /tmp and not shared across invocations,
// so production must use Redis. Local dev falls back to the gitignored
// JSON file when Upstash env vars aren't configured.
function getRedis(): Redis | null {
  // Vercel's Upstash marketplace integration injects KV_REST_API_URL/TOKEN,
  // not the UPSTASH_REDIS_REST_* names Upstash's own docs use — support both.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
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
    // Idempotent membership adds so a wallet's "my questions"/"my answers"
    // history stays discoverable after a round leaves OPEN_ROUNDS_SET —
    // otherwise a resolved round is only reachable if you already know its id.
    await redis.sadd(WALLET_ASKED_PREFIX + round.askerWallet, round.id)
    if (round.answers.length > 0) {
      await Promise.all(
        round.answers.map((a) => redis.sadd(WALLET_ANSWERED_PREFIX + a.verifierWallet, round.id))
      )
    }
    // Public "everyone" feed — capped so it can't grow unbounded. Only
    // resolved rounds (not every intermediate status write) so the feed
    // shows finished outcomes, not in-flight ones.
    if (round.status === 'resolved') {
      await redis.zadd(RECENT_ACTIVITY_ZSET, { score: round.createdAt, member: round.id })
      await redis.zremrangebyrank(RECENT_ACTIVITY_ZSET, 0, -(RECENT_ACTIVITY_CAP + 1))
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

/**
 * `id` is chosen by the client before this is called — the asker's on-chain
 * deposit goes into a vault PDA derived from that same id, so the id has to
 * exist before the deposit transaction can even be built. Rejects an id
 * that's already a round: a retried create request must not reset an
 * existing round back to fresh 'collecting' state.
 */
export async function createRound(params: {
  id: string
  action: string
  question: string
  askerWallet: string
  feeLamports: number
  depositSignature: string
  proofRequirements: ProofRequirements
  windowSeconds: number
}): Promise<VerificationRound> {
  if (!isValidRoundId(params.id)) throw new Error('Invalid round id.')
  if (await readRound(params.id)) throw new Error('This round already exists.')

  const now = Date.now()
  const round: VerificationRound = {
    id: params.id,
    action: params.action,
    question: params.question,
    askerWallet: params.askerWallet,
    feeLamports: params.feeLamports,
    depositSignature: params.depositSignature,
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

/**
 * Every non-open round `wallet` was involved in, as asker or verifier —
 * newest first. Unlike `listOpenRounds`, these are otherwise undiscoverable
 * once a round leaves 'collecting': it's dropped from OPEN_ROUNDS_SET and
 * only reachable by wallet index or by already knowing its id.
 */
export async function listWalletHistory(wallet: string): Promise<VerificationRound[]> {
  const redis = getRedis()
  if (redis) {
    const [askedIds, answeredIds] = await Promise.all([
      redis.smembers(WALLET_ASKED_PREFIX + wallet),
      redis.smembers(WALLET_ANSWERED_PREFIX + wallet),
    ])
    const ids = [...new Set([...askedIds, ...answeredIds])]
    const rounds = await Promise.all(ids.map((id) => getRound(id)))
    return rounds
      .filter((r): r is VerificationRound => r !== undefined && r.status !== 'collecting')
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  const store = loadFileStore()
  const rounds = await Promise.all(Object.values(store).map((r) => closeIfExpired(r)))
  return rounds
    .filter(
      (r) => r.status !== 'collecting' && (r.askerWallet === wallet || r.answers.some((a) => a.verifierWallet === wallet))
    )
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** The most recently resolved rounds across everyone, newest first — a public "what's happening" feed. */
export async function listRecentActivity(limit = 20): Promise<VerificationRound[]> {
  const redis = getRedis()
  if (redis) {
    const ids = await redis.zrange<string[]>(RECENT_ACTIVITY_ZSET, 0, limit - 1, { rev: true })
    const rounds = await Promise.all(ids.map((id) => getRound(id)))
    return rounds.filter((r): r is VerificationRound => r !== undefined)
  }

  const store = loadFileStore()
  const rounds = await Promise.all(Object.values(store).map((r) => closeIfExpired(r)))
  return rounds
    .filter((r) => r.status === 'resolved')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
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
  if (round.askerWallet && round.askerWallet === submission.verifierWallet) {
    throw new Error('You cannot verify your own question.')
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

/**
 * Claims a 'judging' or 'expired' round for settlement by flipping it to
 * 'settling' before any on-chain payout call — a cheap, non-transactional
 * guard against two concurrent requests both trying to pay out (or refund)
 * the same round. 'expired' (zero answers, window passed) is claimable too
 * so the asker's deposit gets refunded instead of stranded in the vault
 * forever. Returns null if the round wasn't in either state (already
 * claimed, or not ready).
 */
export async function claimForSettlement(id: string): Promise<VerificationRound | null> {
  const round = await getRound(id)
  if (!round || (round.status !== 'judging' && round.status !== 'expired')) return null
  const updated: VerificationRound = { ...round, status: 'settling' }
  await persistRound(updated)
  return updated
}

export async function recordJudgments(
  id: string,
  judgments: Record<string, 'correct' | 'incorrect'>,
  resolutionKind: ResolutionKind
): Promise<VerificationRound> {
  const round = await getRound(id)
  if (!round) throw new Error('Round not found.')

  const answers = round.answers.map((a) => ({
    ...a,
    judgment: judgments[a.verifierWallet] ?? a.judgment,
  }))

  const updated: VerificationRound = { ...round, answers, resolutionKind }
  await persistRound(updated)
  return updated
}

export async function cachePayout(
  id: string,
  payment: MultiPaymentResult | null,
  points: Record<string, PointsAwardRecord>
): Promise<VerificationRound> {
  const round = await getRound(id)
  if (!round) throw new Error('Round not found.')

  const updated: VerificationRound = {
    ...round,
    status: 'resolved',
    payment: payment ?? undefined,
    points,
  }
  await persistRound(updated)
  return updated
}
