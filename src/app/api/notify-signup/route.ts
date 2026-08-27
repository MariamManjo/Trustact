import { NextRequest, NextResponse } from 'next/server'
import { isValidEmail, subscribeEmail } from '@/lib/verifier-notifications'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to sign up.'
}

/**
 * POST /api/notify-signup
 * body: { email: string }
 *
 * Opts an email in to "new round opened" notifications. No password/account
 * — just an address on file, same as the rest of this app's zero-friction
 * verifier flow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    await subscribeEmail(email)
    return NextResponse.json({ subscribed: true })
  } catch (err) {
    console.error('notify-signup error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
