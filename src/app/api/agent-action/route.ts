import { NextRequest, NextResponse } from 'next/server'
import { askVerifier, isTelegramConfigured } from '@/lib/telegram-verifier'
import { assessAgentAction } from '@/lib/verify-action'
import { requireAgentApiKey } from '@/lib/agent-auth'

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
 *   Poll statusUrl (GET /api/agent-action/status?requestId=...) until it resolves.
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

    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { error: 'Human verification is required but no verifier network is configured.' },
        { status: 503 }
      )
    }

    const requestId = await askVerifier(assessment.verificationQuestion)

    return NextResponse.json({
      status: 'pending_verification',
      requestId,
      verificationQuestion: assessment.verificationQuestion,
      statusUrl: `/api/agent-action/status?requestId=${requestId}`,
    })
  } catch (err) {
    console.error('agent-action error:', err)
    return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
  }
}
