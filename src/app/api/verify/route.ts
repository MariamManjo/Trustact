import { NextRequest, NextResponse } from 'next/server'
import { askVerifier, isTelegramConfigured } from '@/lib/telegram-verifier'
import { assessAgentAction } from '@/lib/verify-action'

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()

    if (!action || typeof action !== 'string' || action.trim().length < 5) {
      return NextResponse.json(
        { error: 'Describe the action the agent wants to take first.' },
        { status: 400 }
      )
    }

    const assessment = await assessAgentAction(action)

    if (assessment.needsHumanVerification && isTelegramConfigured()) {
      const requestId = await askVerifier(assessment.verificationQuestion)
      return NextResponse.json({ ...assessment, requestId, liveVerifier: true })
    }

    return NextResponse.json({ ...assessment, liveVerifier: false })
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.json(
      { error: 'Verification check failed. Check your OPENAI_API_KEY and try again.' },
      { status: 500 }
    )
  }
}
