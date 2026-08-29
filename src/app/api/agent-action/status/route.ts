import { NextRequest, NextResponse } from 'next/server'
import { requireAgentApiKey } from '@/lib/agent-auth'
import { getRound } from '@/lib/verification-rounds'
import { settleRound } from '@/lib/round-payout'

/**
 * GET /api/agent-action/status?requestId=...
 * header: Authorization: Bearer <AGENT_API_KEY>
 *
 * { status: "pending" }                          — still collecting answers
 * { status: "settling" }                         — full/closed, resolving (or refunding) right now
 * { status: "expired" }                          — window closed with zero answers, refund in flight
 * { status: "declined" }                         — resolved, payout failed or nothing to pay (rare)
 * { status: "approved", payment, points }         — resolved: correct verifiers paid, a push refund,
 *                                                    or (zero answers) the asker's deposit refunded
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

  if (round.status === 'judging' || round.status === 'expired') {
    round = await settleRound(round)
  }

  if (round.status === 'expired') {
    return NextResponse.json({ status: 'expired' })
  }

  if (round.status === 'settling') {
    return NextResponse.json({ status: 'settling' })
  }

  // resolved
  if (!round.payment) {
    return NextResponse.json({ status: 'declined' })
  }

  return NextResponse.json({ status: 'approved', payment: round.payment, points: round.points })
}
