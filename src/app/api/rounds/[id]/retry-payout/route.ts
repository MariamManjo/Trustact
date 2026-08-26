import { NextResponse } from 'next/server'
import { getRound } from '@/lib/verification-rounds'
import { executeRoundPayout } from '@/lib/round-payout'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to retry payout.'
}

/**
 * POST /api/rounds/[id]/retry-payout
 *
 * Safety net for when judgments were saved but the SOL transfer then threw
 * (e.g. a devnet RPC hiccup) — re-attempts payout from the already-stored
 * judgments without asking the asker to re-judge.
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
    if (round.status !== 'judging' || unjudged) {
      return NextResponse.json(
        { error: 'No judgments recorded yet — use /judge first.' },
        { status: 400 }
      )
    }

    const resolved = await executeRoundPayout(round)
    return NextResponse.json(resolved)
  } catch (err) {
    console.error('retry-payout error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
