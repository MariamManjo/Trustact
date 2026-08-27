'use client'

import { WalletError } from '@solana/wallet-adapter-base'
import { AnchorWallet, ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import {
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { ReactNode, useCallback, useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { AnchorProvider } from '@anchor-lang/core'

// No WalletModalProvider here — this app uses its own ConnectWalletModal
// (src/components/trustsaur/connect-wallet-modal.tsx) everywhere instead of
// wallet-adapter-react-ui's default (unstyled) modal/button.
export function SolanaProvider({ children }: { children: ReactNode }) {
  const { cluster } = useCluster()
  const endpoint = useMemo(() => cluster.endpoint, [cluster])
  const onError = useCallback((error: WalletError) => {
    console.error(error)
  }, [])

  // These carry a bundled real logo (data URI) regardless of whether the
  // wallet is actually installed — Wallet Standard auto-detection (which
  // still handles the actual connect for an installed wallet, and covers
  // anything not listed here, e.g. Backpack) only has an icon to offer
  // once a wallet injects itself, which not-installed wallets never do.
  // Without these, ConnectWalletModal fell back to a plain letter avatar
  // for every not-installed entry.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new CoinbaseWalletAdapter(), new TrustWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}

export function useAnchorProvider() {
  const { connection } = useConnection()
  const wallet = useWallet()

  return new AnchorProvider(connection, wallet as AnchorWallet, { commitment: 'confirmed' })
}
