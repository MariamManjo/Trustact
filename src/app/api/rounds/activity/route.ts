import { NextResponse } from 'next/server'
import { listRecentActivity } from '@/lib/verification-rounds'

/**
 * GET /api/rounds/activity — the most recently resolved rounds across
 * everyone, newest first. A public transparency feed: who asked what, who
 * answered, and what got paid out — no wallet required to view it.
 */
export async function GET() {
  const rounds = await listRecentActivity()
  return NextResponse.json({ rounds })
}
