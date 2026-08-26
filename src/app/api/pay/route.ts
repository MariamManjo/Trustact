import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { releaseVerificationPayment } from '@/lib/solana-pay'
import { getVerifierWinner, getVerifierWinnerWallet } from '@/lib/telegram-verifier'
import { awardPurr } from '@/lib/purr-token'

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

    // $PURR is the reputation layer, not the real money — a failed mint must
    // never block or roll back the SOL payment above.
    try {
      const winner = requestId ? getVerifierWinner(requestId) : undefined
      await awardPurr(new PublicKey(result.verifier), {
        withinHalfTimeWindow: winner?.answeredWithinHalfWindow ?? false,
        // No photo-proof capture exists yet (roadmap) — never true today.
        hasPhotoProof: false,
      })
    } catch (purrErr) {
      console.error('$PURR award error:', purrErr)
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Payment error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
