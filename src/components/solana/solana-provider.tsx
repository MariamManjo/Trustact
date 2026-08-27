'use client'

import { WalletError } from '@solana/wallet-adapter-base'
import { AnchorWallet, ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
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

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} onError={onError} autoConnect={false}>
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
