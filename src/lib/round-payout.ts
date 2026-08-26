import { PublicKey } from '@solana/web3.js'
import { cachePayout, type VerificationRound } from './verification-rounds'
import { releaseMultiVerificationPayment } from './solana-pay'
import { awardPurr } from './purr-token'
import { recordJudgment } from './reputation'

/**
 * Runs the SOL payout + $PURR awards + reputation updates for an
 * already-judged round (every answer has a `.judgment`; `bonusWinnerWallet`
 * is set if applicable) and persists the result. Shared by the judge route
 * and the retry-payout safety net, so a failed SOL transfer can be retried
 * without asking the asker to re-judge.
 *
 * recordJudgment() only runs after releaseMultiVerificationPayment()
 * succeeds, so a failed attempt never double-counts reputation on retry.
 */
export async function executeRoundPayout(round: VerificationRound): Promise<VerificationRound> {
  const correctWallets = round.answers.filter((a) => a.judgment === 'correct').map((a) => a.verifierWallet)

  const recipients = round.bonusWinnerWallet
    ? [round.bonusWinnerWallet, ...correctWallets.filter((w) => w !== round.bonusWinnerWallet)]
    : correctWallets

  const payment = await releaseMultiVerificationPayment(recipients, round.feeLamports)

  // $PURR is the reputation layer, not the real money — a failed mint for
  // one recipient must never block or roll back the SOL payment above, or
  // stop the loop for the others.
  const purrAwards: NonNullable<VerificationRound['purrAwards']> = {}
  for (const answer of round.answers) {
    const isCorrect = answer.judgment === 'correct'
    await recordJudgment(answer.verifierWallet, isCorrect)
    if (!isCorrect) continue

    try {
      const award = await awardPurr(new PublicKey(answer.verifierWallet), {
        withinHalfTimeWindow: answer.withinHalfWindow,
        hasPhotoProof: Boolean(answer.photoUrl),
        hasLocationProof: Boolean(answer.location),
        isBonusWinner: answer.verifierWallet === round.bonusWinnerWallet,
      })
      purrAwards[answer.verifierWallet] = { amount: award.amount, breakdown: award.breakdown }
    } catch (purrErr) {
      console.error('round payout $PURR award error for', answer.verifierWallet, purrErr)
    }
  }

  return cachePayout(round.id, payment, purrAwards)
}
