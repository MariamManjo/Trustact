import { NextResponse } from 'next/server'
import { listOpenRounds, STAKE_LAMPORTS } from '@/lib/verification-rounds'

/** GET /api/rounds/open — lightweight feed of rounds still collecting answers. */
export async function GET() {
  try {
    const rounds = await listOpenRounds()
    return NextResponse.json({
      rounds: rounds.map((r) => ({
        id: r.id,
        question: r.question,
        action: r.action,
        proofRequirements: r.proofRequirements,
        stakeLamports: STAKE_LAMPORTS,
        answersCount: r.answers.length,
        closesAt: r.closesAt,
      })),
    })
  } catch (err) {
    console.error('rounds open error:', err)
    return NextResponse.json({ error: 'Failed to load open rounds.' }, { status: 500 })
  }
}
