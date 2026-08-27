import { NextRequest, NextResponse } from 'next/server'
import { getRound, recordJudgments } from '@/lib/verification-rounds'
import { executeRoundPayout } from '@/lib/round-payout'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to judge round.'
}

/**
 * POST /api/rounds/[id]/judge
 * body: { askerWallet?: string, judgments: Record<wallet, 'correct'|'incorrect'>, bonusWinnerWallet?: string }
 *
 * Judges every answer and pays out in one call. Idempotent: if the round is
 * already resolved, returns the cached result instead of re-paying — a
 * doubled network request must never double-spend real SOL.
 *
 * If the round was created with an askerWallet, only that wallet may judge
 * it — otherwise any caller could resolve someone else's round. Rounds
 * created without an askerWallet (e.g. the headless agent API) can't be
 * ownership-checked and are left to the auto-judge majority-vote fallback.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const round = await getRound(id)
    if (!round) {
      return NextResponse.json({ error: 'Round not found.' }, { status: 404 })
    }

    if (round.status === 'resolved') {
      return NextResponse.json(round)
    }

    if (round.status !== 'judging') {
      return NextResponse.json({ error: `Round is still ${round.status} — nothing to judge yet.` }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const askerWallet = typeof body?.askerWallet === 'string' ? body.askerWallet : undefined
    const judgments = body?.judgments as Record<string, 'correct' | 'incorrect'> | undefined
    const bonusWinnerWallet = typeof body?.bonusWinnerWallet === 'string' ? body.bonusWinnerWallet : undefined

    if (round.askerWallet && round.askerWallet !== askerWallet) {
      return NextResponse.json({ error: 'Only the wallet that asked this question can judge it.' }, { status: 403 })
    }

    if (!judgments || typeof judgments !== 'object') {
      return NextResponse.json({ error: 'judgments is required.' }, { status: 400 })
    }

    const missing = round.answers.filter((a) => !judgments[a.verifierWallet])
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Every answer must be judged before payout.' }, { status: 400 })
    }

    const correctWallets = round.answers
      .filter((a) => judgments[a.verifierWallet] === 'correct')
      .map((a) => a.verifierWallet)

    if (bonusWinnerWallet && !correctWallets.includes(bonusWinnerWallet)) {
      return NextResponse.json({ error: 'bonusWinnerWallet must be one of the correct answers.' }, { status: 400 })
    }

    const judged = await recordJudgments(id, judgments, bonusWinnerWallet)
    const resolved = await executeRoundPayout(judged)
    return NextResponse.json(resolved)
  } catch (err) {
    console.error('judge error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
