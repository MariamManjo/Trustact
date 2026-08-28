'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConnectWalletModal } from './connect-wallet-modal'
import { useSignOut } from './auth-session-data-access'
import { useGetBalance } from '@/components/account/account-data-access'

function formatSol(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL`
}

function ellipsify(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-4)}`
}

/** `block`: fills the width with a flat h-10 shape, matching the mobile menu's nav rows instead of the header's pill. */
export function HeaderWalletPill({ block = false }: { block?: boolean }) {
  const { publicKey, connected, disconnect } = useWallet()
  const signOut = useSignOut()
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Same hook, same queryKey, as the Account page — one shared cache so the
  // two never show a different number for the same wallet at the same time.
  const { data: lamports, isLoading: balanceLoading } = useGetBalance({
    address: publicKey ?? undefined,
  })

  const address = publicKey?.toBase58()
  const disconnected = !connected || !publicKey || !address

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleDisconnect() {
    signOut.mutate()
    disconnect()
  }

  return (
    <>
      {disconnected ? (
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
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={
                block
                  ? 'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-sm transition-colors hover:bg-white/5'
                  : 'flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1 pr-2 pl-3 text-sm transition-colors hover:bg-white/5'
              }
            >
              <span className="font-medium tabular-nums">
                {balanceLoading || lamports === undefined ? (
                  <span className="inline-block h-3 w-12 animate-pulse rounded bg-white/10" />
                ) : (
                  formatSol(lamports)
                )}
              </span>
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
            <DropdownMenuItem variant="destructive" onClick={handleDisconnect}>
              <LogOut className="h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConnectWalletModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
