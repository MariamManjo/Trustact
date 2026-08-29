import { NextRequest, NextResponse } from 'next/server'
import { assessAgentAction } from '@/lib/verify-action'
import { ASK_FEE_LAMPORTS } from '@/lib/verification-rounds'

/**
 * POST /api/rounds/assess
 * body: { action: string }
 *
 * Runs the AI gatekeeper only — no round is created and nothing is charged.
 * The asker only pays (via /api/rounds) once they know a human check is
 * actually needed, since charging up front for a question the AI can answer
 * on its own would be a bad, unnecessary fee.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : undefined

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

    return NextResponse.json({ ...assessment, liveVerifier: true, feeLamports: ASK_FEE_LAMPORTS })
  } catch (err) {
    console.error('rounds assess error:', err)
    return NextResponse.json(
      { error: 'Verification check failed. Check your OPENAI_API_KEY and try again.' },
      { status: 500 }
    )
  }
}
