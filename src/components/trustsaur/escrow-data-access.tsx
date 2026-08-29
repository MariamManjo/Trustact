'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import type { PublicKey } from '@solana/web3.js'
import { BN } from '@anchor-lang/core'
import { getTrustactEscrowProgram } from '@project/anchor'
import { useAnchorProvider } from '@/components/solana/solana-provider'
import { roundIdToBytes } from '@/lib/escrow-pda'

/**
 * Builds and sends the asker's `deposit` call into `roundId`'s vault PDA —
 * the one wallet transaction in the whole ask flow, since verifiers answer
 * for free. The vault account itself isn't passed explicitly: its address
 * is fully determined by the `round_id` seed, so Anchor's client derives it
 * automatically from the instruction argument. Returns the confirmed
 * signature the server verifies before it opens the round.
 */
export function useDepositToRound() {
  const { publicKey } = useWallet()
  const provider = useAnchorProvider()

  return async function depositToRound(roundId: string, lamports: number): Promise<string> {
    if (!publicKey) throw new Error('Connect your wallet first.')

    const program = getTrustactEscrowProgram(provider)

    return program.methods
      .deposit(roundIdToBytes(roundId), new BN(lamports))
      .accounts({ asker: publicKey as PublicKey })
      .rpc()
  }
}
