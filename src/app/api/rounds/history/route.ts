import { NextRequest, NextResponse } from 'next/server'
import { listWalletHistory } from '@/lib/verification-rounds'

/**
 * GET /api/rounds/history?wallet=...
 *
 * Every non-open round `wallet` asked or answered, newest first — the
 * "what happened to my question" / "what did I answer" view. A round drops
 * out of /api/rounds/open the moment it resolves or expires, so without
 * this it's undiscoverable again unless you already have its id.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet is required.' }, { status: 400 })
  }

  const rounds = await listWalletHistory(wallet)
  return NextResponse.json({ rounds })
}
