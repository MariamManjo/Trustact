import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { AnchorProvider, Program, BN, type Idl, type Wallet } from '@anchor-lang/core'
import { loadPayerKeypair } from './solana-keys'
import { ESCROW_PROGRAM_ID, roundIdToBytes, deriveRoundVaultPda } from './escrow-pda'
import escrowIdl from '../../anchor/target/idl/trustact_escrow.json'

/**
 * @anchor-lang/core's own `Wallet` (NodeWallet) is exported from its ESM
 * build via a CJS `require()` assignment that bundlers can't see statically
 * — Turbopack fails the build with "Export Wallet doesn't exist". This is
 * the same shape, implemented directly to avoid depending on that export.
 */
class KeypairWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([this.payer])
    else tx.partialSign(this.payer)
    return tx
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)))
  }
}

export { getEscrowProgramAddress, roundIdToBytes, deriveRoundVaultPda } from './escrow-pda'

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'

function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed')
}

function buildTxExplorerUrl(signature: string): string {
  const isPublicDevnet = RPC_URL.includes('devnet.solana.com')
  return isPublicDevnet
    ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    : `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`
}

function getAuthorityProgram() {
  const payer = loadPayerKeypair()
  const connection = getConnection()
  const provider = new AnchorProvider(connection, new KeypairWallet(payer), { commitment: 'confirmed' })
  return { program: new Program(escrowIdl as Idl, provider), payer, connection }
}

/**
 * Confirms `signature` is a finalized transfer of at least `minLamports`
 * from `askerWallet` into `roundId`'s vault PDA. Reads the vault's resulting
 * on-chain balance rather than parsing instruction logs — the PDA is owned
 * by our program and can only hold lamports the `deposit` instruction put
 * there, so a sufficient balance already is the proof.
 */
export async function verifyDeposit(
  roundId: string,
  signature: string,
  askerWallet: string,
  minLamports: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const connection = getConnection()
  const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })

  if (!tx) return { ok: false, reason: 'Deposit transaction not found on-chain yet. Try again in a moment.' }
  if (tx.meta?.err) return { ok: false, reason: 'Deposit transaction failed on-chain.' }

  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58())
  if (!keys.includes(askerWallet)) {
    return { ok: false, reason: 'Deposit transaction was not sent from the asker wallet.' }
  }

  const vault = deriveRoundVaultPda(roundId)
  const vaultInfo = await connection.getAccountInfo(vault)
  if (!vaultInfo || !vaultInfo.owner.equals(ESCROW_PROGRAM_ID)) {
    return { ok: false, reason: 'Deposit vault not found on-chain yet. Try again in a moment.' }
  }
  if (vaultInfo.lamports < minLamports) {
    return { ok: false, reason: `Deposit must be at least ${minLamports / LAMPORTS_PER_SOL} SOL.` }
  }

  return { ok: true }
}

/**
 * Deposits `lamports` into `roundId`'s vault signed by our own backend
 * authority rather than an end user's wallet — used for agent-triggered
 * rounds (see /api/agent-action), where there's no human in the loop to
 * approve a wallet popup. Trustact funds the pool itself for that path.
 */
export async function depositFromAuthority(roundId: string, lamports: number): Promise<string> {
  const { program, payer } = getAuthorityProgram()
  const roundIdBytes = roundIdToBytes(roundId)

  return program.methods
    .deposit(roundIdBytes, new BN(lamports))
    .accounts({ asker: payer.publicKey })
    .rpc()
}

export interface EscrowPayoutResult {
  signature: string
  explorerUrl: string
  totalAmountSol: number
  recipients: { wallet: string; amountSol: number }[]
}

/**
 * Pays every recipient out of `roundId`'s vault in one atomic transaction —
 * one `payout_one` CPI per recipient, plus a final `close_round` that
 * refunds whatever's left (the platform cut on a majority resolution, or
 * just the rent-exempt minimum on a push) to the backend authority.
 * All-or-nothing: either every recipient gets paid and the vault closes, or
 * none of it happens.
 *
 * Returns null (not an error) when every recipient's amount is zero —
 * nothing to pay, so the round is just closed and its rent reclaimed.
 */
export async function releaseEscrowPayout(
  roundId: string,
  recipients: { wallet: string; lamports: number }[]
): Promise<EscrowPayoutResult | null> {
  const { program, payer, connection } = getAuthorityProgram()
  const roundIdBytes = roundIdToBytes(roundId)
  const nonZero = recipients.filter((r) => r.lamports > 0)

  const payoutIxs = await Promise.all(
    nonZero.map((r) =>
      program.methods
        .payoutOne(roundIdBytes, new BN(r.lamports))
        .accounts({ authority: payer.publicKey, recipient: new PublicKey(r.wallet) })
        .instruction()
    )
  )
  const closeIx = await program.methods
    .closeRound(roundIdBytes)
    .accounts({ authority: payer.publicKey })
    .instruction()

  const transaction = new Transaction().add(...payoutIxs, closeIx)
  const signature = await sendAndConfirmTransaction(connection, transaction, [payer])

  if (nonZero.length === 0) return null

  return {
    signature,
    explorerUrl: buildTxExplorerUrl(signature),
    totalAmountSol: nonZero.reduce((sum, r) => sum + r.lamports, 0) / LAMPORTS_PER_SOL,
    recipients: nonZero.map((r) => ({ wallet: r.wallet, amountSol: r.lamports / LAMPORTS_PER_SOL })),
  }
}
