'use client'

import { useState } from 'react'
import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectWalletModal } from '@/components/trustsaur/connect-wallet-modal'
import { useVerifierIdentity } from '@/components/trustsaur/verifier-identity'

export default function AccountListFeature() {
  const { publicKey } = useVerifierIdentity()
  const [open, setOpen] = useState(false)

  if (publicKey) {
    return redirect(`/account/${publicKey}`)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Wallet className="h-5 w-5 text-violet-400" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Connect your wallet</h1>
        <p className="text-sm text-muted-foreground">See your balance and transaction history.</p>
      </div>
      <Button
        onClick={() => setOpen(true)}
        className="h-10 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
      >
        Sign in
      </Button>
      <ConnectWalletModal open={open} onOpenChange={setOpen} />
    </div>
  )
}
