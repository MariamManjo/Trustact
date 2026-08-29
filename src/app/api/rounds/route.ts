import { NextRequest, NextResponse } from 'next/server'
import { assessAgentAction } from '@/lib/verify-action'
import { createRound, STAKE_LAMPORTS } from '@/lib/verification-rounds'
import { VERIFICATION_WINDOW_SECONDS } from '@/lib/verification-window'
import { notifyNewRound } from '@/lib/notify-verifiers'

/**
 * POST /api/rounds
 * body: { action: string, askerWallet: string, proofRequirements?: { photoRequired?: boolean, locationRequired?: boolean } }
 *
 * Free to post — there's no asker fee. Requires a connected wallet so the
 * round has an owner (used to block that wallet from answering its own
 * question). Runs the AI gatekeeper; if human verification is needed,
 * opens a round up to 5 verifiers can answer.
 * Verifiers stake STAKE_LAMPORTS of their own to answer (see the answer
 * route) and the round resolves by consensus among them, not by the asker.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : undefined
    const askerWallet = typeof body?.askerWallet === 'string' ? body.askerWallet : undefined
    const photoRequired = body?.proofRequirements?.photoRequired === true
    const locationRequired = body?.proofRequirements?.locationRequired === true

    if (!action || action.trim().length < 5) {
      return NextResponse.json(
        { error: 'Describe the action the agent wants to take first.' },
        { status: 400 }
      )
    }
    if (!askerWallet) {
      return NextResponse.json({ error: 'Connect your wallet to ask a question.' }, { status: 400 })
    }

    const assessment = await assessAgentAction(action)

    if (!assessment.needsHumanVerification) {
      return NextResponse.json({ ...assessment, liveVerifier: false })
    }

    const round = await createRound({
      action,
      question: assessment.verificationQuestion,
      askerWallet,
      proofRequirements: { photoRequired, locationRequired },
      windowSeconds: VERIFICATION_WINDOW_SECONDS,
    })

    await notifyNewRound(round)

    return NextResponse.json({
      ...assessment,
      liveVerifier: true,
      roundId: round.id,
      proofRequirements: round.proofRequirements,
      stakeLamports: STAKE_LAMPORTS,
    })
  } catch (err) {
    console.error('rounds create error:', err)
    return NextResponse.json(
      { error: 'Verification check failed. Check your OPENAI_API_KEY and try again.' },
      { status: 500 }
    )
  }
}
