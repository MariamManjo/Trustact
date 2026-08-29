import { NextRequest, NextResponse } from 'next/server'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { loadPayerKeypair } from '@/lib/solana-keys'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const FAUCET_AMOUNT_LAMPORTS = 0.05 * LAMPORTS_PER_SOL
// Never drain the payer below this — it also funds agent-action deposits,
// round payouts, and expired-round refunds, which matter more than a faucet.
const MIN_PAYER_RESERVE_LAMPORTS = 0.05 * LAMPORTS_PER_SOL

/**
 * POST /api/faucet
 * body: { wallet: string }
 *
 * Sends a small amount of devnet SOL from our own funded payer wallet — a
 * reliable alternative to Solana's shared public devnet faucet, which every
 * dApp on devnet hits and which is frequently exhausted/rate-limited as a
 * result. Rate-limited per wallet (once a day) and per IP so it can't be
 * drained by one visitor.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = typeof body?.wallet === 'string' ? body.wallet : undefined
    if (!wallet) {
      return NextResponse.json({ error: 'wallet is required.' }, { status: 400 })
    }

    let recipient: PublicKey
    try {
      recipient = new PublicKey(wallet)
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
    }

    const [walletLimit, ipLimit] = await Promise.all([
      checkRateLimit(`ratelimit:faucet:wallet:${wallet}`, 1, 24 * 60 * 60),
      checkRateLimit(`ratelimit:faucet:ip:${getClientIp(req)}`, 5, 60 * 60),
    ])
    if (!walletLimit.allowed) {
      return NextResponse.json(
        {
          error:
            'This wallet already claimed devnet SOL from our faucet today. Try again tomorrow, or use faucet.solana.com.',
        },
        { status: 429 }
      )
    }
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many faucet requests. Try again in an hour.' }, { status: 429 })
    }

    const payer = loadPayerKeypair()
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed')

    const payerBalance = await connection.getBalance(payer.publicKey)
    if (payerBalance < FAUCET_AMOUNT_LAMPORTS + MIN_PAYER_RESERVE_LAMPORTS) {
      return NextResponse.json(
        { error: 'Our faucet is out of funds right now. Try faucet.solana.com instead.' },
        { status: 503 }
      )
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: FAUCET_AMOUNT_LAMPORTS,
      })
    )
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer])

    return NextResponse.json({ signature, amountSol: FAUCET_AMOUNT_LAMPORTS / LAMPORTS_PER_SOL })
  } catch (err) {
    console.error('faucet error:', err)
    return NextResponse.json({ error: 'Faucet request failed. Try again.' }, { status: 500 })
  }
}
