import { NextRequest, NextResponse } from 'next/server'
import { getReputation } from '@/lib/reputation'
import { tierFor } from '@/lib/tiers'
import { getWalletActivityCounts, listWalletHistory } from '@/lib/verification-rounds'

/** GET /api/reputation?wallet=<address> — the full profile stats card: tier, accuracy, and lifetime asked/answered/earned. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet is required.' }, { status: 400 })
  }

  try {
    const [reputation, counts, history] = await Promise.all([
      getReputation(wallet),
      getWalletActivityCounts(wallet),
      listWalletHistory(wallet),
    ])

    const earnedSol = history
      .flatMap((r) => r.payment?.recipients ?? [])
      .filter((r) => r.wallet === wallet)
      .reduce((sum, r) => sum + r.amountSol, 0)

    return NextResponse.json({
      ...reputation,
      tier: tierFor(reputation.correct),
      asked: counts.asked,
      // The wallet->round answered-index is forward-only (added after
      // reputation tracking already existed), so it can undercount versus
      // judged answers from before it shipped — never show fewer answered
      // than correct+incorrect, since every judged answer was answered.
      answered: Math.max(counts.answered, reputation.correct + reputation.incorrect),
      earnedSol,
    })
  } catch (err) {
    console.error('reputation error:', err)
    return NextResponse.json({ error: 'Failed to load reputation.' }, { status: 500 })
  }
}
