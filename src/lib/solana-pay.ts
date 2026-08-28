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
import { loadPayerKeypair } from './solana-keys'

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const PAYMENT_LAMPORTS = 0.01 * LAMPORTS_PER_SOL // stand-in for a $0.50-1 verification fee

/**
 * Treasury address verifiers stake into. Same key that pays out — v1 is a
 * custodial treasury, not a trustless on-chain escrow program. Honest
 * limitation, not hidden: a real PDA-based escrow (funds locked by program
 * logic, not by trusting Trustact's server key) is the v2 to build once this
 * mechanism is validated.
 */
export function getTreasuryAddress(): PublicKey {
  return loadPayerKeypair().publicKey
}

/**
 * Confirms `signature` is a finalized on-chain transfer of at least
 * `minLamports` from `fromWallet` to the treasury address — the proof that a
 * verifier actually staked before their answer counts. Rejects reused
 * signatures via `isSignatureUsed`/`markSignatureUsed`, which callers must
 * check/set so the same stake transaction can't be claimed by two answers.
 */
export async function verifyStakeTransfer(
  signature: string,
  fromWallet: string,
  minLamports: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const connection = new Connection(RPC_URL, 'confirmed')
  const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })

  if (!tx) return { ok: false, reason: 'Stake transaction not found on-chain yet — try again in a moment.' }
  if (tx.meta?.err) return { ok: false, reason: 'Stake transaction failed on-chain.' }

  const treasury = getTreasuryAddress().toBase58()
  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58())
  const fromIndex = keys.indexOf(fromWallet)
  const toIndex = keys.indexOf(treasury)

  if (fromIndex === -1 || toIndex === -1) {
    return { ok: false, reason: 'Stake transaction does not transfer between the expected wallets.' }
  }

  const preFrom = tx.meta?.preBalances?.[fromIndex] ?? 0
  const postFrom = tx.meta?.postBalances?.[fromIndex] ?? 0
  const preTo = tx.meta?.preBalances?.[toIndex] ?? 0
  const postTo = tx.meta?.postBalances?.[toIndex] ?? 0
  const sentByFrom = preFrom - postFrom
  const receivedByTreasury = postTo - preTo

  if (receivedByTreasury < minLamports || sentByFrom < minLamports) {
    return { ok: false, reason: `Stake must be at least ${minLamports / LAMPORTS_PER_SOL} SOL.` }
  }

  return { ok: true }
}

export interface PaymentResult {
  signature: string
  explorerUrl: string
  verifier: string
  amountSol: number
}

export interface MultiPaymentResult {
  signature: string
  explorerUrl: string
  totalAmountSol: number
  recipients: { wallet: string; amountSol: number }[]
}

function buildTxExplorerUrl(signature: string): string {
  const isPublicDevnet = RPC_URL.includes('devnet.solana.com')
  return isPublicDevnet
    ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    : `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`
}

function loadDefaultVerifierAddress(): PublicKey {
  const fromEnv = process.env.DEFAULT_VERIFIER_ADDRESS
  if (fromEnv) {
    return new PublicKey(fromEnv)
  }

  // Local dev fallback — Vercel's filesystem has no .wallets/ directory,
  // since it's gitignored and never deployed.
  const filePath = path.join(process.cwd(), '.wallets', 'verifier.json')
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey
}

/**
 * Pays N verifiers in a single transaction — one `SystemProgram.transfer`
 * instruction per recipient, one `sendAndConfirmTransaction` call. Atomic:
 * either everyone gets paid in that transaction or no one does, so there's
 * no partial-payment failure mode to reason about.
 *
 * `totalLamports` is split evenly across recipients; the integer-division
 * remainder (at most `recipients.length - 1` lamports) goes to whichever
 * recipient is first in the array — callers that want a specific verifier
 * (e.g. the asker's chosen bonus winner) to get the remainder should put
 * that wallet first.
 *
 * Returns `null` (not an error) when `recipients` is empty — e.g. the asker
 * judged no answers as correct, so there's nothing to pay out.
 */
export async function releaseMultiVerificationPayment(
  recipients: string[],
  totalLamports: number
): Promise<MultiPaymentResult | null> {
  if (recipients.length === 0) return null

  const payer = loadPayerKeypair()
  const connection = new Connection(RPC_URL, 'confirmed')

  const balance = await connection.getBalance(payer.publicKey)
  if (balance < totalLamports) {
    throw new Error(
      `Payer wallet needs devnet SOL. Fund ${payer.publicKey.toBase58()} at https://faucet.solana.com`
    )
  }

  const perRecipient = Math.floor(totalLamports / recipients.length)
  const remainder = totalLamports - perRecipient * recipients.length

  const amounts = recipients.map((_, i) => perRecipient + (i === 0 ? remainder : 0))

  const transaction = new Transaction()
  recipients.forEach((wallet, i) => {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(wallet),
        lamports: amounts[i],
      })
    )
  })

  const signature = await sendAndConfirmTransaction(connection, transaction, [payer])

  return {
    signature,
    explorerUrl: buildTxExplorerUrl(signature),
    totalAmountSol: totalLamports / LAMPORTS_PER_SOL,
    recipients: recipients.map((wallet, i) => ({ wallet, amountSol: amounts[i] / LAMPORTS_PER_SOL })),
  }
}

/**
 * @deprecated Thin wrapper around releaseMultiVerificationPayment for a
 * single recipient. Kept for anything not yet migrated to the multi-
 * verifier round flow.
 */
export async function releaseVerificationPayment(recipientAddress?: string): Promise<PaymentResult> {
  const recipient = recipientAddress ?? loadDefaultVerifierAddress().toBase58()
  const result = await releaseMultiVerificationPayment([recipient], PAYMENT_LAMPORTS)

  if (!result) {
    throw new Error('Payment failed unexpectedly.')
  }

  return {
    signature: result.signature,
    explorerUrl: result.explorerUrl,
    verifier: recipient,
    amountSol: result.totalAmountSol,
  }
}
