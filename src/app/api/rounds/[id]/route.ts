import { NextResponse } from 'next/server'
import { getRound } from '@/lib/verification-rounds'
import { settleRound } from '@/lib/round-payout'

/**
 * GET /api/rounds/[id] — full round state, backs asker/verifier polling.
 * Settles by consensus if the round closed (full, or window passed) since
 * the last read — covers the case where the last answer's own request
 * already tried, or nobody answered again to trigger it there.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let round = await getRound(id)
  if (!round) {
    return NextResponse.json({ error: 'Round not found.' }, { status: 404 })
  }

  if (round.status === 'judging') {
    round = await settleRound(round)
  }

  return NextResponse.json(round)
}
