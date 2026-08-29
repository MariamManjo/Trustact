'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { usePrivy } from '@privy-io/react-auth'
import { useWallets as usePrivySolanaWallets, useSignMessage as usePrivySignMessage } from '@privy-io/react-auth/solana'

export interface VerifierIdentity {
  publicKey: string | null
  connected: boolean
  source: 'wallet' | 'google' | null
  /** Absent when there's nothing connected, or the connected wallet can't sign (rare adapter case). */
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null
}

/**
 * A connected Phantom/Solflare/etc. wallet, or a Google-login Privy embedded
 * wallet — whichever is present, wallet-adapter takes priority since that's
 * the only path that can also sign the on-chain escrow deposit (asking a
 * question). Both are valid identities for everything that doesn't need a
 * transaction signature: answering a round, reputation, history, sign-in.
 */
export function useVerifierIdentity(): VerifierIdentity {
  const adapter = useWallet()
  const { authenticated } = usePrivy()
  const { wallets: privyWallets } = usePrivySolanaWallets()
  const { signMessage: privySignMessage } = usePrivySignMessage()

  if (adapter.connected && adapter.publicKey) {
    const adapterSignMessage = adapter.signMessage
    return {
      publicKey: adapter.publicKey.toBase58(),
      connected: true,
      source: 'wallet',
      signMessage: adapterSignMessage ? (bytes) => adapterSignMessage(bytes) : null,
    }
  }

  const privyWallet = authenticated ? privyWallets[0] : undefined
  if (privyWallet) {
    return {
      publicKey: privyWallet.address,
      connected: true,
      source: 'google',
      signMessage: async (bytes) => {
        const { signature } = await privySignMessage({ message: bytes, wallet: privyWallet })
        return signature
      },
    }
  }

  return { publicKey: null, connected: false, source: null, signMessage: null }
}
