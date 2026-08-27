import { NextRequest, NextResponse } from 'next/server'
import { destroySession, SESSION_COOKIE } from '@/lib/auth-session'

/** POST /api/auth/logout — clears the session, server-side and client-side. */
export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value
  await destroySession(sessionId)
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
