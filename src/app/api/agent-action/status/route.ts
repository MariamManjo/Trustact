import { NextRequest, NextResponse } from 'next/server'
import { requireAgentApiKey } from '@/lib/agent-auth'
import { getRound, recordJudgments, type VerificationRound } from '@/lib/verification-rounds'
import { executeRoundPayout } from '@/lib/round-payout'

/**
 * No human "asker" is necessarily watching a headless agent's round, so it
 * can't wait forever for a judge. If nobody has judged any answer by one
 * full extra window past the collection deadline, auto-resolve by majority
 * answer — no bonus winner, same idempotent payout as a human judge call.
 */
async function autoJudgeIfOverdue(round: VerificationRound): Promise<VerificationRound> {
  if (round.status !== 'judging') return round
  if (round.answers.some((a) => a.judgment)) return round // a human already started judging

  const graceDeadline = round.closesAt + round.windowSeconds * 1000
  if (Date.now() < graceDeadline) return round

  const yesCount = round.answers.filter((a) => a.answer === 'yes').length
  const noCount = round.answers.length - yesCount
  const majorityAnswer = yesCount >= noCount ? 'yes' : 'no'

  const judgments: Record<string, 'correct' | 'incorrect'> = {}
  for (const answer of round.answers) {
    judgments[answer.verifierWallet] = answer.answer === majorityAnswer ? 'correct' : 'incorrect'
  }

  const judged = await recordJudgments(round.id, judgments)
  return executeRoundPayout(judged)
}

/**
 * GET /api/agent-action/status?requestId=...
 * header: Authorization: Bearer <AGENT_API_KEY>
 *
 * { status: "pending" }                                — still collecting answers
 * { status: "awaiting_asker_judgment" }                 — full/closed, waiting on a human judge or the auto-judge grace period
 * { status: "expired" }                                 — window closed with zero answers
 * { status: "declined" }                                — resolved, nobody judged correct
 * { status: "approved", payment, purrAwards }           — resolved, at least one correct verifier paid
 */
export async function GET(req: NextRequest) {
  const authError = requireAgentApiKey(req)
  if (authError) return authError

  const requestId = req.nextUrl.searchParams.get('requestId')
  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
  }

  let round = await getRound(requestId)
  if (!round) {
    return NextResponse.json({ error: 'Round not found.' }, { status: 404 })
  }

  if (round.status === 'collecting') {
    return NextResponse.json({ status: 'pending' })
  }

  if (round.status === 'expired') {
    return NextResponse.json({ status: 'expired' })
  }

  if (round.status === 'judging') {
    round = await autoJudgeIfOverdue(round)
    if (round.status === 'judging') {
      return NextResponse.json({ status: 'awaiting_asker_judgment' })
    }
  }

  // resolved
  if (!round.payment) {
    return NextResponse.json({ status: 'declined' })
  }

  return NextResponse.json({ status: 'approved', payment: round.payment, purrAwards: round.purrAwards })
}
