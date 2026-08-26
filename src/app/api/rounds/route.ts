import { NextRequest, NextResponse } from 'next/server'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { assessAgentAction } from '@/lib/verify-action'
import { createRound } from '@/lib/verification-rounds'
import { usdToLamports } from '@/lib/sol-price'
import { VERIFICATION_WINDOW_SECONDS } from '@/lib/verification-window'

const MIN_FEE_USD = 1

/**
 * POST /api/rounds
 * body: { action: string, feeSol?: number, askerWallet?: string }
 *
 * Runs the AI gatekeeper; if human verification is needed, opens a round up
 * to 5 verifiers can answer. The asker sets the fee (SOL), with a $1
 * equivalent minimum enforced here.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : undefined
    const feeSol = typeof body?.feeSol === 'number' ? body.feeSol : undefined
    const askerWallet = typeof body?.askerWallet === 'string' ? body.askerWallet : undefined

    if (!action || action.trim().length < 5) {
      return NextResponse.json(
        { error: 'Describe the action the agent wants to take first.' },
        { status: 400 }
      )
    }

    const assessment = await assessAgentAction(action)

    if (!assessment.needsHumanVerification) {
      return NextResponse.json({ ...assessment, liveVerifier: false })
    }

    const minFeeLamports = await usdToLamports(MIN_FEE_USD)
    const requestedLamports = feeSol ? Math.round(feeSol * LAMPORTS_PER_SOL) : minFeeLamports

    if (requestedLamports < minFeeLamports) {
      return NextResponse.json(
        { error: `Fee must be at least ${(minFeeLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL (~$${MIN_FEE_USD}).` },
        { status: 400 }
      )
    }

    const round = await createRound({
      action,
      question: assessment.verificationQuestion,
      askerWallet,
      feeLamports: requestedLamports,
      // Photo/location capture ships in a later phase — forced off for now
      // regardless of what's requested, so the round never gets stuck
      // waiting on proof the UI can't yet collect.
      proofRequirements: { photoRequired: false, locationRequired: false },
      windowSeconds: VERIFICATION_WINDOW_SECONDS,
    })

    return NextResponse.json({
      ...assessment,
      liveVerifier: true,
      roundId: round.id,
      proofRequirements: round.proofRequirements,
      feeLamports: round.feeLamports,
    })
  } catch (err) {
    console.error('rounds create error:', err)
    return NextResponse.json(
      { error: 'Verification check failed. Check your OPENAI_API_KEY and try again.' },
      { status: 500 }
    )
  }
}
