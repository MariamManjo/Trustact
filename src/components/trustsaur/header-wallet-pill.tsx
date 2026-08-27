'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConnectWalletModal } from './connect-wallet-modal'

function formatSol(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL`
}

function ellipsify(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-4)}`
}

/** `block`: fills the width with a flat h-10 shape, matching the mobile menu's nav rows instead of the header's pill. */
export function HeaderWalletPill({ block = false }: { block?: boolean }) {
  const { connection } = useConnection()
  const { publicKey, connected, disconnect } = useWallet()
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: lamports } = useQuery({
    queryKey: ['header-wallet-balance', { endpoint: connection.rpcEndpoint, address: publicKey?.toBase58() }],
    queryFn: () => connection.getBalance(publicKey!),
    enabled: connected && Boolean(publicKey),
    refetchInterval: 30_000,
  })

  if (!connected || !publicKey) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setModalOpen(true)}
          className={
            block
              ? 'h-10 w-full rounded-lg border-violet-400/40 bg-transparent text-violet-300 hover:bg-violet-500/10 hover:text-violet-200'
              : 'rounded-full border-violet-400/40 bg-transparent text-violet-300 hover:bg-violet-500/10 hover:text-violet-200'
          }
        >
          Sign in
        </Button>
        <ConnectWalletModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    )
  }

  const address = publicKey.toBase58()

  async function copyAddress() {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={
            block
              ? 'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-sm transition-colors hover:bg-white/5'
              : 'flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1 pr-2 pl-3 text-sm transition-colors hover:bg-white/5'
          }
        >
          <span className="font-medium tabular-nums">{lamports !== undefined ? formatSol(lamports) : '…'}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/5 py-0.5 pr-2 pl-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <Image src="/mascot.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
            <span className="font-mono text-xs text-muted-foreground">{ellipsify(address)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copyAddress}>
          <Copy className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy address'}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            View on Explorer
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => disconnect()}>
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
