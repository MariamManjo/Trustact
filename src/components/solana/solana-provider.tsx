'use client'

import { WalletError } from '@solana/wallet-adapter-base'
import { AnchorWallet, ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { ReactNode, useCallback, useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { AnchorProvider } from '@anchor-lang/core'

// No WalletModalProvider here — this app uses its own ConnectWalletModal
// (src/components/trustsaur/connect-wallet-modal.tsx) everywhere instead of
// wallet-adapter-react-ui's default (unstyled) modal/button.
//
// wallets={[]}: real detection is Wallet Standard-only, deliberately. An
// earlier version also registered a few legacy adapter instances (Phantom,
// Solflare, ...) here purely so their bundled icon was available before the
// wallet actually injects itself. wallet-adapter-react does dedupe a legacy
// adapter against a same-named Standard one, but it's still a second live
// adapter instance — with its own connect() implementation — sitting in the
// mix for however long that dedup takes to settle after mount. Not worth it
// just for an icon; ConnectWalletModal now sources fallback icons from
// adapter instances that are never registered with WalletProvider at all,
// so there's zero chance of them touching the actual connect flow.
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
