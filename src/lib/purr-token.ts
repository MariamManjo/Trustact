import { Connection, PublicKey } from '@solana/web3.js'
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { loadPayerKeypair } from './solana-keys'

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'

function loadPurrMintAddress(): string {
  const mintAddress = process.env.PURR_MINT_ADDRESS
  if (!mintAddress) {
    throw new Error('PURR_MINT_ADDRESS not set — check .env.local')
  }
  return mintAddress
}

function loadPurrMint(): PublicKey {
  return new PublicKey(loadPurrMintAddress())
}

function buildAddressExplorerUrl(address: string): string {
  const isPublicDevnet = RPC_URL.includes('devnet.solana.com')
  return isPublicDevnet
    ? `https://explorer.solana.com/address/${address}?cluster=devnet`
    : `https://explorer.solana.com/address/${address}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`
}

export interface AwardPurrOptions {
  /** Answered within half the stated verification window. */
  withinHalfTimeWindow?: boolean
  /** A photo proof was attached to the verifier's answer. */
  hasPhotoProof?: boolean
  /** A location proof was attached to the verifier's answer. */
  hasLocationProof?: boolean
  /** The asker chose this answer as the round's standout — bonus on top of the base award. */
  isBonusWinner?: boolean
}

export interface PurrBreakdown {
  base: number
  speedBonus: number
  photoBonus: number
  locationBonus: number
  bonusWinnerBonus: number
}

export interface AwardPurrResult {
  ata: string
  amount: number
  breakdown: PurrBreakdown
  mint: string
  mintExplorerUrl: string
}

export function calculatePurrBreakdown(options: AwardPurrOptions = {}): PurrBreakdown {
  return {
    base: 10,
    speedBonus: options.withinHalfTimeWindow ? 5 : 0,
    photoBonus: options.hasPhotoProof ? 5 : 0,
    locationBonus: options.hasLocationProof ? 5 : 0,
    bonusWinnerBonus: options.isBonusWinner ? 10 : 0,
  }
}

export async function awardPurr(
  verifierWallet: PublicKey,
  options: AwardPurrOptions = {}
): Promise<AwardPurrResult> {
  const connection = new Connection(RPC_URL, 'confirmed')
  const payer = loadPayerKeypair()
  const mintAddress = loadPurrMintAddress()
  const mint = new PublicKey(mintAddress)
  const breakdown = calculatePurrBreakdown(options)
  const amount =
    breakdown.base + breakdown.speedBonus + breakdown.photoBonus + breakdown.locationBonus + breakdown.bonusWinnerBonus

  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, verifierWallet)
  await mintTo(connection, payer, mint, ata.address, payer, amount)

  return {
    ata: ata.address.toBase58(),
    amount,
    breakdown,
    mint: mintAddress,
    mintExplorerUrl: buildAddressExplorerUrl(mintAddress),
  }
}

export async function getPurrBalance(verifierWallet: PublicKey): Promise<number> {
  const connection = new Connection(RPC_URL, 'confirmed')
  const mint = loadPurrMint()

  const accounts = await connection.getParsedTokenAccountsByOwner(verifierWallet, { mint })
  if (accounts.value.length === 0) return 0

  return accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0
}
