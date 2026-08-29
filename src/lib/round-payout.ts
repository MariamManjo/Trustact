import {
  cachePayout,
  claimForSettlement,
  computeConsensus,
  computeSpeedWeights,
  getPoolLamports,
  recordJudgments,
  PLATFORM_CUT_RATE,
  type VerificationRound,
} from './verification-rounds'
import { releaseEscrowPayout } from './escrow-pay'
import { recordJudgment } from './reputation'
import { calculatePoints, totalPoints } from './reputation-points'

/**
 * Settles a round that just became 'judging' (full, or its window passed) —
 * no asker, no self-interested judge. Resolution is majority consensus among
 * the answers themselves:
 *
 *  - solo / unanimous / tie → push: the whole pool splits by speed with no
 *    platform cut (nothing was actually resolved competitively).
 *  - a real majority → correct answerers split the pool minus
 *    PLATFORM_CUT_RATE, weighted by how fast each one answered.
 *
 * Guarded by claimForSettlement's 'judging' -> 'settling' flip so two
 * concurrent callers (e.g. two people polling the same round at once) can't
 * both trigger a payout for it. Safe to call speculatively — returns the
 * round unchanged if it wasn't actually ready.
 */
export async function settleRound(round: VerificationRound): Promise<VerificationRound> {
  if (round.status !== 'judging') return round

  const claimed = await claimForSettlement(round.id)
  if (!claimed) return round // someone else already claimed it

  const { judgments, resolutionKind } = computeConsensus(claimed.answers)
  const judged = await recordJudgments(claimed.id, judgments, resolutionKind)

  return payoutJudgedRound(judged)
}

/**
 * Pays out a round that's already been consensus-judged (`resolutionKind` +
 * per-answer `.judgment` set) but isn't resolved yet — either the tail end
 * of settleRound, or a retry after a prior payout transaction threw (e.g. a
 * devnet RPC hiccup). Never re-judges, so a retry can't flip the outcome.
 */
export async function payoutJudgedRound(judged: VerificationRound): Promise<VerificationRound> {
  const pool = getPoolLamports(judged)
  const correct = judged.answers.filter((a) => a.judgment === 'correct')

  const isPush = judged.resolutionKind !== 'majority'
  const totalToSplit = isPush ? pool : Math.floor(pool * (1 - PLATFORM_CUT_RATE))

  const weights = computeSpeedWeights(correct, judged)
  const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0)

  const recipients = correct.map((a) => ({
    wallet: a.verifierWallet,
    lamports: Math.floor((weights[a.verifierWallet] / weightSum) * totalToSplit),
  }))

  const payment = await releaseEscrowPayout(judged.id, recipients)

  const pointsAwards: NonNullable<VerificationRound['points']> = {}
  for (const answer of judged.answers) {
    const isCorrect = answer.judgment === 'correct'
    let awarded = 0
    if (isCorrect) {
      const breakdown = calculatePoints({
        withinHalfTimeWindow: answer.withinHalfWindow,
        hasPhotoProof: Boolean(answer.photoUrl),
        hasLocationProof: Boolean(answer.location),
      })
      awarded = totalPoints(breakdown)
      pointsAwards[answer.verifierWallet] = { amount: awarded, breakdown }
    }
    await recordJudgment(answer.verifierWallet, isCorrect, awarded)
  }

  return cachePayout(judged.id, payment, pointsAwards)
}
