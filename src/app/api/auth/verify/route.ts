import { NextRequest, NextResponse } from 'next/server'
import {
  buildSignInMessage,
  createSession,
  isMessageFresh,
  verifySignature,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@/lib/auth-session'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Sign-in failed.'
}

/**
 * POST /api/auth/verify
 * body: { wallet: string, issuedAt: string, signature: number[] }
 *
 * Verifies a Sign-In With Solana signature (see WALLET_UX_SPEC.md §2) and
 * issues a session cookie. The message itself is rebuilt server-side from
 * `wallet` + `issuedAt` rather than trusted as-sent, so a client can't get a
 * session by signing some other message and passing it off as this one.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = typeof body?.wallet === 'string' ? body.wallet : undefined
    const issuedAt = typeof body?.issuedAt === 'string' ? body.issuedAt : undefined
    const signature = Array.isArray(body?.signature) ? (body.signature as number[]) : undefined

    if (!wallet || !issuedAt || !signature) {
      return NextResponse.json({ error: 'wallet, issuedAt, and signature are required.' }, { status: 400 })
    }

    if (!isMessageFresh(issuedAt)) {
      return NextResponse.json({ error: 'Sign-in request expired — try again.' }, { status: 400 })
    }

    const domain = req.nextUrl.hostname
    const message = buildSignInMessage(wallet, issuedAt, domain)

    if (!verifySignature(message, signature, wallet)) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }

    const sessionId = await createSession(wallet)
    const res = NextResponse.json({ wallet })
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('auth verify error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
