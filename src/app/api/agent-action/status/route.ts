import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import {
  getVerifierStatus,
  getVerifierWinner,
  getVerifierWinnerWallet,
  getCachedPayment,
  setCachedPayment,
} from '@/lib/telegram-verifier'
import { releaseVerificationPayment } from '@/lib/solana-pay'
import { awardPurr } from '@/lib/purr-token'
import { requireAgentApiKey } from '@/lib/agent-auth'

/**
 * GET /api/agent-action/status?requestId=...
 * header: Authorization: Bearer <AGENT_API_KEY>
 *
 * { status: "pending" }
 * { status: "declined", verifiedBy }
 * { status: "approved", verifiedBy, payment: { signature, explorerUrl, verifier, amountSol } }
 */
export async function GET(req: NextRequest) {
  const authError = requireAgentApiKey(req)
  if (authError) return authError

  const requestId = req.nextUrl.searchParams.get('requestId')

  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
  }

  const verifierStatus = getVerifierStatus(requestId)
  const winner = getVerifierWinner(requestId)
  const verifiedBy = winner ? (winner.username ? `@${winner.username}` : winner.firstName) : undefined

  if (verifierStatus === 'unknown' || verifierStatus === 'pending') {
    return NextResponse.json({ status: 'pending' })
  }

  if (verifierStatus === 'no') {
    return NextResponse.json({ status: 'declined', verifiedBy })
  }

  // verifierStatus === 'yes' — release payment once, then serve the cached result.
  const cached = getCachedPayment(requestId)
  if (cached) {
    return NextResponse.json({ status: 'approved', verifiedBy, payment: cached })
  }

  try {
    const payment = await releaseVerificationPayment(await getVerifierWinnerWallet(requestId))
    setCachedPayment(requestId, payment)

    // $PURR is the reputation layer, not the real money — a failed mint must
    // never block or roll back the SOL payment above.
    try {
      await awardPurr(new PublicKey(payment.verifier), {
        withinHalfTimeWindow: winner?.answeredWithinHalfWindow ?? false,
        // No photo-proof capture exists yet (roadmap) — never true today.
        hasPhotoProof: false,
      })
    } catch (purrErr) {
      console.error('agent-action $PURR award error:', purrErr)
    }

    return NextResponse.json({ status: 'approved', verifiedBy, payment })
  } catch (err) {
    console.error('agent-action payment error:', err)
    return NextResponse.json(
      { status: 'approved', error: 'Verified, but payment failed to release. Retry shortly.' },
      { status: 502 }
    )
  }
}
