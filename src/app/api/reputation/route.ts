import { NextRequest, NextResponse } from 'next/server'
import { getReputation } from '@/lib/reputation'
import { tierFor } from '@/lib/tiers'

/** GET /api/reputation?wallet=<address> */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet is required.' }, { status: 400 })
  }

  try {
    const reputation = await getReputation(wallet)
    return NextResponse.json({ ...reputation, tier: tierFor(reputation.correct) })
  } catch (err) {
    console.error('reputation error:', err)
    return NextResponse.json({ error: 'Failed to load reputation.' }, { status: 500 })
  }
}
