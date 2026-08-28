'use client'

import { type Adapter, WalletError } from '@solana/wallet-adapter-base'
import { AnchorWallet, ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { ReactNode, useCallback, useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { AnchorProvider } from '@anchor-lang/core'
import { SignInOnConnect } from '@/components/trustsaur/auth-session-data-access'

// No WalletModalProvider here — this app uses its own ConnectWalletModal
// (src/components/trustsaur/connect-wallet-modal.tsx) everywhere instead of
// wallet-adapter-react-ui's default (unstyled) modal/button.
//
// Empty, module-level array: Wallet Standard detection is the only source
// of adapters. An inline `wallets={[]}` is a new array every render, which
// makes wallet-adapter-react rebuild its adapter list and — on mobile —
// construct a fresh Mobile Wallet Adapter, whose unmount cleanup then
// marks the wallet disconnected. Keep this reference stable.
const NO_LEGACY_ADAPTERS: Adapter[] = []

export function SolanaProvider({ children }: { children: ReactNode }) {
  const { cluster } = useCluster()
  const endpoint = useMemo(() => cluster.endpoint, [cluster])
  const onError = useCallback((error: WalletError) => {
    console.error(error)
  }, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={NO_LEGACY_ADAPTERS} onError={onError} autoConnect={false}>
        <SignInOnConnect />
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
