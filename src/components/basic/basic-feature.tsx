'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { ExplorerLink } from '../cluster/cluster-ui'
import { ConnectWalletModal } from '../trustsaur/connect-wallet-modal'
import { Button } from '@/components/ui/button'
import { useBasicProgram } from './basic-data-access'
import { BasicCreate, BasicProgram } from './basic-ui'
import { AppHero } from '../app-hero'
import { ellipsify } from '@/lib/utils'

export default function BasicFeature() {
  const { publicKey } = useWallet()
  const { programId } = useBasicProgram()
  const [connectOpen, setConnectOpen] = useState(false)

  return publicKey ? (
    <div>
      <AppHero title="Basic" subtitle={'Run the program by clicking the "Run program" button.'}>
        <p className="mb-6">
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        <BasicCreate />
      </AppHero>
      <BasicProgram />
    </div>
  ) : (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 py-16 text-center">
      <Button
        onClick={() => setConnectOpen(true)}
        className="h-10 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
      >
        Sign in
      </Button>
      <ConnectWalletModal open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}
