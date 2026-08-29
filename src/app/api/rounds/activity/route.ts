import { NextResponse } from 'next/server'
import { listRecentActivity } from '@/lib/verification-rounds'
import { getProfiles } from '@/lib/user-profiles'

/**
 * GET /api/rounds/activity — the most recently resolved rounds across
 * everyone, newest first. A public transparency feed: who asked what, who
 * answered, and what got paid out — no wallet required to view it.
 */
export async function GET() {
  const rounds = await listRecentActivity()
  const wallets = rounds.flatMap((r) => [r.askerWallet, ...r.answers.map((a) => a.verifierWallet)])
  const profiles = await getProfiles(wallets)
  const nicknames = Object.fromEntries(
    Object.entries(profiles)
      .filter(([, p]) => p.nickname)
      .map(([w, p]) => [w, p.nickname])
  )

  return NextResponse.json({ rounds, nicknames })
}
