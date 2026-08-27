'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ConnectWalletModal } from './connect-wallet-modal'

function formatSol(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL`
}

/** `block`: fills the width with a flat h-10 shape, matching the mobile menu's nav rows instead of the header's pill. */
export function HeaderWalletPill({ block = false }: { block?: boolean }) {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const [modalOpen, setModalOpen] = useState(false)

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
          onClick={() => setModalOpen(true)}
          className={
            block
              ? 'h-10 w-full rounded-lg bg-violet-500 text-white hover:bg-violet-500/90'
              : 'rounded-full bg-violet-500 text-white hover:bg-violet-500/90'
          }
        >
          Connect wallet
        </Button>
        <ConnectWalletModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    )
  }

  return (
    <div
      className={
        block
          ? 'flex h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-sm'
          : 'flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1 pr-1 pl-3 text-sm'
      }
    >
      <span className="font-medium tabular-nums">{lamports !== undefined ? formatSol(lamports) : '…'}</span>
      <Image src="/mascot.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
    </div>
  )
}
