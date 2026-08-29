import { PublicKey } from '@solana/web3.js'
import escrowIdl from '../../anchor/target/idl/trustact_escrow.json'

/** Safe to import from client or server code — no secrets, just program/PDA math. */
export const ESCROW_PROGRAM_ID = new PublicKey(escrowIdl.address)

export function getEscrowProgramAddress(): string {
  return ESCROW_PROGRAM_ID.toBase58()
}

/** The round's UUID as the raw 16 bytes used for its PDA seed — same encoding on-chain and off. */
export function roundIdToBytes(roundId: string): number[] {
  const hex = roundId.replace(/-/g, '')
  if (hex.length !== 32 || !/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error('roundId must be a UUID.')
  }
  return [...Buffer.from(hex, 'hex')]
}

export function deriveRoundVaultPda(roundId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('round'), Buffer.from(roundIdToBytes(roundId))],
    ESCROW_PROGRAM_ID
  )
  return pda
}
