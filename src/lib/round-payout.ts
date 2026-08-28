import { PublicKey } from '@solana/web3.js'
import {
  cachePayout,
  claimForSettlement,
  computeConsensus,
  getStakePoolLamports,
  recordJudgments,
  STAKE_LAMPORTS,
  PLATFORM_CUT_RATE,
  type VerificationRound,
} from './verification-rounds'
import { releaseMultiVerificationPayment } from './solana-pay'
import { awardPurr } from './purr-token'
import { recordJudgment } from './reputation'

/**
 * Settles a round that just became 'judging' (full, or its window passed) —
 * no asker, no self-interested judge. Resolution is majority consensus among
 * the answers themselves:
 *
 *  - solo / unanimous / tie → push: every verifier's stake is returned,
 *    Trustact takes nothing (nothing was actually resolved competitively).
 *  - a real majority → the minority's stakes fund the majority's payout,
 *    minus PLATFORM_CUT_RATE, split evenly (all stakes are equal, so an even
 *    split among the correct wallets is the correct parimutuel result).
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
 * of settleRound, or a retry after a prior SOL transfer threw (e.g. a
 * devnet RPC hiccup). Never re-judges, so a retry can't flip the outcome.
 */
export async function payoutJudgedRound(judged: VerificationRound): Promise<VerificationRound> {
  const pool = getStakePoolLamports(judged)
  const correctWallets = judged.answers.filter((a) => a.judgment === 'correct').map((a) => a.verifierWallet)

  // Push: refund exactly what was staked. Even split of the full pool across
  // every answerer equals each getting STAKE_LAMPORTS back, since stakes are
  // fixed and equal.
  const isPush = judged.resolutionKind !== 'majority'
  const recipients = isPush ? judged.answers.map((a) => a.verifierWallet) : correctWallets
  const totalLamports = isPush ? pool : Math.floor(pool * (1 - PLATFORM_CUT_RATE))

  const payment = await releaseMultiVerificationPayment(recipients, totalLamports)

  // $PURR is the reputation layer, not the real money — a failed mint for
  // one recipient must never block or roll back the SOL payment above, or
  // stop the loop for the others.
  const purrAwards: NonNullable<VerificationRound['purrAwards']> = {}
  for (const answer of judged.answers) {
    const isCorrect = answer.judgment === 'correct'
    await recordJudgment(answer.verifierWallet, isCorrect)
    if (!isCorrect) continue

    try {
      const award = await awardPurr(new PublicKey(answer.verifierWallet), {
        withinHalfTimeWindow: answer.withinHalfWindow,
        hasPhotoProof: Boolean(answer.photoUrl),
        hasLocationProof: Boolean(answer.location),
      })
      purrAwards[answer.verifierWallet] = { amount: award.amount, breakdown: award.breakdown }
    } catch (purrErr) {
      console.error('round payout $PURR award error for', answer.verifierWallet, purrErr)
    }
  }

  return cachePayout(judged.id, payment, purrAwards)
}

/** Re-exported so callers that already import STAKE_LAMPORTS from here keep working. */
export { STAKE_LAMPORTS }
