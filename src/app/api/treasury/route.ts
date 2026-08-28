import { NextResponse } from 'next/server'
import { getTreasuryAddress } from '@/lib/solana-pay'

/**
 * GET /api/treasury — the address verifiers stake into before answering.
 * Single source of truth for the client (which can't import solana-pay.ts
 * directly, since loadPayerKeypair() reads a server-only key file/env var).
 */
export async function GET() {
  try {
    return NextResponse.json({ address: getTreasuryAddress().toBase58() })
  } catch (err) {
    console.error('treasury address error:', err)
    return NextResponse.json({ error: 'Treasury not configured.' }, { status: 500 })
  }
}
