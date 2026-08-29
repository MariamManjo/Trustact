import { NextRequest, NextResponse } from 'next/server'
import { createRound, isValidRoundId, ASK_FEE_LAMPORTS } from '@/lib/verification-rounds'
import { verifyDeposit } from '@/lib/escrow-pay'
import { VERIFICATION_WINDOW_SECONDS } from '@/lib/verification-window'
import { notifyNewRound } from '@/lib/notify-verifiers'

/**
 * POST /api/rounds
 * body: { roundId, action, question, askerWallet, depositSignature, proofRequirements? }
 *
 * Call this only after /api/rounds/assess said a human check is needed and
 * the asker has already deposited on-chain into `roundId`'s vault (see
 * escrow-pay.ts) — this route verifies that deposit actually happened, then
 * opens the round for up to 5 verifiers to answer for free. They split the
 * deposited pool by consensus and speed, no self-judging by the asker.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const roundId = typeof body?.roundId === 'string' ? body.roundId : undefined
    const action = typeof body?.action === 'string' ? body.action : undefined
    const question = typeof body?.question === 'string' ? body.question : undefined
    const askerWallet = typeof body?.askerWallet === 'string' ? body.askerWallet : undefined
    const depositSignature = typeof body?.depositSignature === 'string' ? body.depositSignature : undefined
    const photoRequired = body?.proofRequirements?.photoRequired === true
    const locationRequired = body?.proofRequirements?.locationRequired === true

    if (!roundId || !isValidRoundId(roundId)) {
      return NextResponse.json({ error: 'A valid roundId is required.' }, { status: 400 })
    }
    if (!action || action.trim().length < 5 || !question) {
      return NextResponse.json({ error: 'action and question are required.' }, { status: 400 })
    }
    if (!askerWallet) {
      return NextResponse.json({ error: 'Connect your wallet to ask a question.' }, { status: 400 })
    }
    if (!depositSignature) {
      return NextResponse.json({ error: 'A deposit transaction is required to open a round.' }, { status: 400 })
    }

    const depositCheck = await verifyDeposit(roundId, depositSignature, askerWallet, ASK_FEE_LAMPORTS)
    if (!depositCheck.ok) {
      return NextResponse.json({ error: depositCheck.reason }, { status: 400 })
    }

    const round = await createRound({
      id: roundId,
      action,
      question,
      askerWallet,
      feeLamports: ASK_FEE_LAMPORTS,
      depositSignature,
      proofRequirements: { photoRequired, locationRequired },
      windowSeconds: VERIFICATION_WINDOW_SECONDS,
    })

    await notifyNewRound(round)

    return NextResponse.json({
      roundId: round.id,
      proofRequirements: round.proofRequirements,
      poolLamports: round.feeLamports,
    })
  } catch (err) {
    console.error('rounds create error:', err)
    return NextResponse.json({ error: 'Could not open this round. Try again.' }, { status: 500 })
  }
}
