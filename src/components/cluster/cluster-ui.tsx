'use client'

import { useConnection } from '@solana/wallet-adapter-react'

import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { ReactNode } from 'react'

import { useCluster } from './cluster-data-access'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { AppAlert } from '@/components/app-alert'

export function ExplorerLink({ path, label, className }: { path: string; label: string; className?: string }) {
  const { getExplorerUrl } = useCluster()
  return (
    <a
      href={getExplorerUrl(path)}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? className : `link font-mono`}
    >
      {label}
    </a>
  )
}

export function ClusterChecker({ children }: { children: ReactNode }) {
  const { cluster } = useCluster()
  const { connection } = useConnection()

  const query = useQuery({
    queryKey: ['version', { cluster, endpoint: connection.rpcEndpoint }],
    queryFn: () => connection.getVersion(),
    retry: 1,
  })
  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return (
      <AppAlert
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Refresh
          </Button>
        }
      >
        Error connecting to cluster <span className="font-bold">{cluster.name}</span>.
      </AppAlert>
    )
  }
  return children
}

/**
 * Quiet, non-interactive status text — not a button. This product only ever
 * runs on devnet in practice; a full network-switcher control next to
 * "Sign in" implied a real choice end users don't actually have, and
 * competed with it for attention. The interactive ClusterUiSelect dropdown
 * below still exists for anywhere that genuinely needs to switch clusters.
 */
export function NetworkBadge() {
  const { cluster } = useCluster()
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-400">
      {cluster.name}
    </span>
  )
}

/** `block`: fills the width with a flat h-10 shape, matching the mobile menu's nav rows instead of the header's pill. */
export function ClusterUiSelect({ block = false }: { block?: boolean } = {}) {
  const { clusters, setCluster, cluster } = useCluster()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={
            block
              ? 'h-10 w-full justify-start rounded-lg border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
              : 'rounded-full border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
          }
        >
          {cluster.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {clusters.map((item) => (
          <DropdownMenuItem key={item.name} onClick={() => setCluster(item)}>
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
