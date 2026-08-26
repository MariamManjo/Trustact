import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getReputation } from '@/lib/reputation'
import { getPurrBalance } from '@/lib/purr-token'
import { tierFor } from '@/lib/tiers'

/** GET /api/reputation?wallet=<address> */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet is required.' }, { status: 400 })
  }

  try {
    const [reputation, purrBalance] = await Promise.all([
      getReputation(wallet),
      getPurrBalance(new PublicKey(wallet)),
    ])

    return NextResponse.json({ ...reputation, purrBalance, tier: tierFor(purrBalance) })
  } catch (err) {
    console.error('reputation error:', err)
    return NextResponse.json({ error: 'Failed to load reputation.' }, { status: 500 })
  }
}
