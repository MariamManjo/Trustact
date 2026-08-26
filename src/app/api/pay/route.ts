import { NextRequest, NextResponse } from 'next/server'
import { releaseVerificationPayment } from '@/lib/solana-pay'
import { getVerifierWinnerWallet } from '@/lib/telegram-verifier'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Payment failed.'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const requestId = typeof body?.requestId === 'string' ? body.requestId : undefined
    const winnerWallet = requestId ? await getVerifierWinnerWallet(requestId) : undefined

    const result = await releaseVerificationPayment(winnerWallet)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Payment error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
