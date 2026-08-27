import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet, SESSION_COOKIE } from '@/lib/auth-session'

/** GET /api/auth/session — returns the signed-in wallet for the current session cookie, if any. */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  const wallet = await getSessionWallet(sessionId)
  return NextResponse.json({ wallet })
}
