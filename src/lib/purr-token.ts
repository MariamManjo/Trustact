import { Connection, PublicKey } from '@solana/web3.js'
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { loadPayerKeypair } from './solana-keys'

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'

function loadPurrMint(): PublicKey {
  const mintAddress = process.env.PURR_MINT_ADDRESS
  if (!mintAddress) {
    throw new Error('PURR_MINT_ADDRESS not set — check .env.local')
  }
  return new PublicKey(mintAddress)
}

export interface AwardPurrOptions {
  /** Answered within half the stated verification window. */
  withinHalfTimeWindow?: boolean
  /** A photo proof was attached to the verifier's answer. */
  hasPhotoProof?: boolean
}

export interface AwardPurrResult {
  ata: string
  amount: number
}

export function calculatePurrAward(options: AwardPurrOptions = {}): number {
  let amount = 10
  if (options.withinHalfTimeWindow) amount += 5
  if (options.hasPhotoProof) amount += 5
  return amount
}

export async function awardPurr(
  verifierWallet: PublicKey,
  options: AwardPurrOptions = {}
): Promise<AwardPurrResult> {
  const connection = new Connection(RPC_URL, 'confirmed')
  const payer = loadPayerKeypair()
  const mint = loadPurrMint()
  const amount = calculatePurrAward(options)

  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, verifierWallet)
  await mintTo(connection, payer, mint, ata.address, payer, amount)

  return { ata: ata.address.toBase58(), amount }
}

export async function getPurrBalance(verifierWallet: PublicKey): Promise<number> {
  const connection = new Connection(RPC_URL, 'confirmed')
  const mint = loadPurrMint()

  const accounts = await connection.getParsedTokenAccountsByOwner(verifierWallet, { mint })
  if (accounts.value.length === 0) return 0

  return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0
}
