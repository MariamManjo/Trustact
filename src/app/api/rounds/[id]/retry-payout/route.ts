import { NextResponse } from 'next/server'
import { getRound } from '@/lib/verification-rounds'
import { payoutJudgedRound } from '@/lib/round-payout'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to retry payout.'
}

/**
 * POST /api/rounds/[id]/retry-payout
 *
 * Safety net for when a round was consensus-judged (flipped to 'settling')
 * but the SOL transfer then threw (e.g. a devnet RPC hiccup) — re-attempts
 * payout from the already-recorded judgments without re-judging, so a retry
 * can never flip the outcome. No ownership check: the result is
 * deterministic from data already on the round, not a decision anyone makes.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const round = await getRound(id)
    if (!round) {
      return NextResponse.json({ error: 'Round not found.' }, { status: 404 })
    }

    if (round.status === 'resolved') {
      return NextResponse.json(round)
    }

    const unjudged = round.answers.some((a) => !a.judgment)
    if (round.status !== 'settling' || unjudged || !round.resolutionKind) {
      return NextResponse.json(
        { error: 'This round has no recorded judgment yet — nothing to retry.' },
        { status: 400 }
      )
    }

    const resolved = await payoutJudgedRound(round)
    return NextResponse.json(resolved)
  } catch (err) {
    console.error('retry-payout error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
