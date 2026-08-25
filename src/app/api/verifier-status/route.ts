import { NextRequest, NextResponse } from 'next/server'
import { getVerifierStatus, getVerifierWinner } from '@/lib/telegram-verifier'

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get('requestId')

  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
  }

  const status = getVerifierStatus(requestId)
  const winner = getVerifierWinner(requestId)

  return NextResponse.json({
    status,
    verifiedBy: winner ? (winner.username ? `@${winner.username}` : winner.firstName) : undefined,
  })
}
