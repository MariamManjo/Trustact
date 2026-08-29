import { NextRequest, NextResponse } from 'next/server'
import { getProfile, isValidNickname, setNickname } from '@/lib/user-profiles'
import { getSessionWallet, SESSION_COOKIE } from '@/lib/auth-session'

async function requireWallet(req: NextRequest): Promise<string | null> {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  return getSessionWallet(sessionId)
}

/** GET /api/profile?wallet=... — public, so nicknames can render anywhere a wallet shows up. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet is required.' }, { status: 400 })
  }

  const profile = await getProfile(wallet)
  return NextResponse.json({ wallet, nickname: profile?.nickname ?? null })
}

/**
 * PATCH /api/profile
 * body: { nickname: string }
 *
 * Requires a signed-in wallet (Sign-In With Solana session) — same model as
 * /api/notify-signup — so setting a nickname is a real account action, not
 * an anonymous claim anyone could make for any wallet.
 */
export async function PATCH(req: NextRequest) {
  const wallet = await requireWallet(req)
  if (!wallet) {
    return NextResponse.json({ error: 'Sign in with your wallet first.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''

  // Empty clears the nickname back to showing the wallet address.
  if (nickname !== '' && !isValidNickname(nickname)) {
    return NextResponse.json(
      { error: 'Nickname must be 1-24 characters: letters, numbers, spaces, - or _.' },
      { status: 400 }
    )
  }

  const profile = await setNickname(wallet, nickname === '' ? null : nickname)
  return NextResponse.json({ wallet, nickname: profile.nickname })
}
