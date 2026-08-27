'use client'

import { ReactQueryProvider } from './react-query-provider'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { SolanaProvider } from '@/components/solana/solana-provider'
import React from 'react'

// Theming lives in AppLayout's ThemeProvider (forced dark — see app-layout.tsx).
// This used to also wrap a second, contradictory ThemeProvider(defaultTheme="system")
// around everything, a leftover from before the app went dark-only.
export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ReactQueryProvider>
      <ClusterProvider>
        <SolanaProvider>{children}</SolanaProvider>
      </ClusterProvider>
    </ReactQueryProvider>
  )
}
