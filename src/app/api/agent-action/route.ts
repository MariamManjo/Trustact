import { NextRequest, NextResponse } from 'next/server'
import { assessAgentAction } from '@/lib/verify-action'
import { requireAgentApiKey } from '@/lib/agent-auth'
import { createRound } from '@/lib/verification-rounds'
import { usdToLamports } from '@/lib/sol-price'
import { VERIFICATION_WINDOW_SECONDS } from '@/lib/verification-window'

const DEFAULT_FEE_USD = 1

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
 *   resolves. Up to 5 wallet-connected verifiers can answer; if no human
 *   judges the round in time, it auto-resolves by majority answer.
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
        { error: 'action is required — describe what the agent wants to do.' },
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

    const feeLamports = await usdToLamports(DEFAULT_FEE_USD)
    const round = await createRound({
      action,
      question: assessment.verificationQuestion,
      feeLamports,
      proofRequirements: { photoRequired: false, locationRequired: false },
      windowSeconds: VERIFICATION_WINDOW_SECONDS,
    })

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
