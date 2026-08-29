import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { assessAgentAction } from '@/lib/verify-action'
import { requireAgentApiKey } from '@/lib/agent-auth'
import { createRound, ASK_FEE_LAMPORTS } from '@/lib/verification-rounds'
import { depositFromAuthority } from '@/lib/escrow-pay'
import { loadPayerKeypair } from '@/lib/solana-keys'
import { VERIFICATION_WINDOW_SECONDS } from '@/lib/verification-window'
import { notifyNewRound } from '@/lib/notify-verifiers'

/**
 * Public API for AI agents.
 *
 * POST /api/agent-action
 * header: Authorization: Bearer <AGENT_API_KEY>
 * body: { agentId: string, action: string }
 *
 * Response — no human check needed:
 *   { status: "approved", confidence, reasoning }
 *
 * Response — needs a human to verify first:
 *   { status: "pending_verification", requestId, verificationQuestion, statusUrl }
 *   Poll statusUrl (GET /api/agent-action/status?requestId=...) until it
 *   resolves. Up to 5 wallet-connected verifiers can answer for free; the
 *   round's pool (which Trustact funds for this API, not the calling agent)
 *   is what they split.
 */
export async function POST(req: NextRequest) {
  const authError = requireAgentApiKey(req)
  if (authError) return authError

  try {
    const body = await req.json()
    const { agentId, action } = body ?? {}

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ error: 'agentId is required.' }, { status: 400 })
    }

    if (!action || typeof action !== 'string' || action.trim().length < 5) {
      return NextResponse.json(
        { error: 'action is required, describe what the agent wants to do.' },
        { status: 400 }
      )
    }

    const assessment = await assessAgentAction(action)

    if (!assessment.needsHumanVerification) {
      return NextResponse.json({
        status: 'approved',
        confidence: assessment.confidence,
        reasoning: assessment.reasoning,
      })
    }

    const roundId = randomUUID()
    const depositSignature = await depositFromAuthority(roundId, ASK_FEE_LAMPORTS)

    const round = await createRound({
      id: roundId,
      action,
      question: assessment.verificationQuestion,
      askerWallet: loadPayerKeypair().publicKey.toBase58(),
      feeLamports: ASK_FEE_LAMPORTS,
      depositSignature,
      proofRequirements: { photoRequired: false, locationRequired: false },
      windowSeconds: VERIFICATION_WINDOW_SECONDS,
    })

    await notifyNewRound(round)

    return NextResponse.json({
      status: 'pending_verification',
      requestId: round.id,
      verificationQuestion: assessment.verificationQuestion,
      statusUrl: `/api/agent-action/status?requestId=${round.id}`,
    })
  } catch (err) {
    console.error('agent-action error:', err)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}
