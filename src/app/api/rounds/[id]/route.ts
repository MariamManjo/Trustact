import { NextResponse } from 'next/server'
import { getRound } from '@/lib/verification-rounds'

/** GET /api/rounds/[id] — full round state, backs both asker polling and the judge UI. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const round = await getRound(id)
  if (!round) {
    return NextResponse.json({ error: 'Round not found.' }, { status: 404 })
  }

  return NextResponse.json(round)
}
