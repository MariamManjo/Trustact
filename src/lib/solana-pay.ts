import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import fs from 'fs'
import path from 'path'

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const PAYMENT_LAMPORTS = 0.01 * LAMPORTS_PER_SOL // stand-in for a $0.50-1 verification fee

export interface PaymentResult {
  signature: string
  explorerUrl: string
  verifier: string
  amountSol: number
}

function loadKeypair(filename: string): Keypair {
  const filePath = path.join(process.cwd(), '.wallets', filename)
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

/**
 * Pays a verifier for a confirmed check. If `recipientAddress` is provided
 * (the verifier's own registered wallet), payment goes there. Otherwise it
 * falls back to the default demo wallet — used only when a verifier hasn't
 * registered a real address yet.
 */
export async function releaseVerificationPayment(recipientAddress?: string): Promise<PaymentResult> {
  const payer = loadKeypair('payer.json')
  const connection = new Connection(RPC_URL, 'confirmed')

  const recipient = recipientAddress
    ? new PublicKey(recipientAddress)
    : loadKeypair('verifier.json').publicKey

  const balance = await connection.getBalance(payer.publicKey)
  if (balance < PAYMENT_LAMPORTS) {
    throw new Error(
      `Payer wallet needs devnet SOL. Fund ${payer.publicKey.toBase58()} at https://faucet.solana.com`
    )
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: PAYMENT_LAMPORTS,
    })
  )

  const signature = await sendAndConfirmTransaction(connection, transaction, [payer])

  const isPublicDevnet = RPC_URL.includes('devnet.solana.com')
  const explorerUrl = isPublicDevnet
    ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    : `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`

  return {
    signature,
    explorerUrl,
    verifier: recipient.toBase58(),
    amountSol: PAYMENT_LAMPORTS / LAMPORTS_PER_SOL,
  }
}
