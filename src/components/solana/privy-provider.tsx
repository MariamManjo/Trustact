'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { ReactNode } from 'react'

/**
 * Google sign-in for people who don't have a Solana wallet — Privy creates a
 * real embedded Solana wallet for them on first login. Deliberately separate
 * from SolanaProvider/wallet-adapter: Privy's embedded wallet does not
 * register itself as a Wallet Standard provider (confirmed against Privy's
 * own reference Next.js template, which uses its own hooks throughout, not
 * wallet-adapter), so it can't be picked up by the existing useWallet() the
 * rest of this app is built on. See useVerifierIdentity for how the two are
 * reconciled for identity purposes (answering, reputation, history).
 *
 * Always mounted, matching Privy's own reference template — several
 * components call Privy hooks (via useVerifierIdentity) unconditionally,
 * which is only legal if a PrivyProvider ancestor is always present.
 * Conditionally skipping this wrapper would make every one of those hook
 * calls throw whenever the App ID happened to be unset, taking down far
 * more than just the Google sign-in button.
 */
export function AppPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={{
        loginMethods: ['google'],
        appearance: { walletChainType: 'solana-only' },
        embeddedWallets: { solana: { createOnLogin: 'users-without-wallets' } },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
