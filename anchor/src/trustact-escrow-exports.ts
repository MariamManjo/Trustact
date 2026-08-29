// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@anchor-lang/core'
import { Cluster, PublicKey } from '@solana/web3.js'
import TrustactEscrowIDL from '../target/idl/trustact_escrow.json'
import type { TrustactEscrow } from '../target/types/trustact_escrow'

// Re-export the generated IDL and type
export { TrustactEscrow, TrustactEscrowIDL }

// The programId is imported from the program IDL.
export const TRUSTACT_ESCROW_PROGRAM_ID = new PublicKey(TrustactEscrowIDL.address)

// This is a helper function to get the Trustact escrow Anchor program.
export function getTrustactEscrowProgram(provider: AnchorProvider, address?: PublicKey): Program<TrustactEscrow> {
  return new Program(
    { ...TrustactEscrowIDL, address: address ? address.toBase58() : TrustactEscrowIDL.address } as TrustactEscrow,
    provider
  )
}

// This is a helper function to get the program ID for the escrow program depending on the cluster.
export function getTrustactEscrowProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
    case 'mainnet-beta':
    default:
      return TRUSTACT_ESCROW_PROGRAM_ID
  }
}
