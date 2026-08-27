import { NextRequest, NextResponse } from 'next/server'
import { isValidEmail, subscribeEmail, getSubscribedEmail, unsubscribeWallet } from '@/lib/verifier-notifications'
import { getSessionWallet, SESSION_COOKIE } from '@/lib/auth-session'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to sign up.'
}

async function requireWallet(req: NextRequest): Promise<string | null> {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  return getSessionWallet(sessionId)
}

/**
 * POST /api/notify-signup
 * body: { email: string }
 *
 * Opts in to "new round opened" notifications — requires a signed-in wallet
 * (Sign-In With Solana session), so this is a real account setting rather
 * than an anonymous, unverified email anyone could submit.
 */
export async function POST(req: NextRequest) {
  try {
    const wallet = await requireWallet(req)
    if (!wallet) {
      return NextResponse.json({ error: 'Sign in with your wallet first.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    await subscribeEmail(wallet, email)
    return NextResponse.json({ subscribed: true, email })
  } catch (err) {
    console.error('notify-signup error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/** GET /api/notify-signup — the current wallet's notification email, if any. */
export async function GET(req: NextRequest) {
  const wallet = await requireWallet(req)
  if (!wallet) return NextResponse.json({ email: null })
  const email = await getSubscribedEmail(wallet)
  return NextResponse.json({ email })
}

/** DELETE /api/notify-signup — turns off notifications for the current wallet. */
export async function DELETE(req: NextRequest) {
  const wallet = await requireWallet(req)
  if (!wallet) {
    return NextResponse.json({ error: 'Sign in with your wallet first.' }, { status: 401 })
  }
  await unsubscribeWallet(wallet)
  return NextResponse.json({ subscribed: false })
}
