'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ExplorerLink } from '../cluster/cluster-ui'
import { AccountBalance, AccountButtons, AccountTokens, AccountTransactions } from './account-ui'
import { ellipsify } from '@/lib/utils'

export default function AccountDetailFeature() {
  const params = useParams()
  const address = useMemo(() => {
    if (!params.address) {
      return
    }
    try {
      return new PublicKey(params.address)
    } catch (e) {
      console.log(`Invalid public key`, e)
    }
  }, [params])
  if (!address) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Error loading account.</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <AccountBalance address={address} />
        <ExplorerLink
          path={`account/${address}`}
          label={ellipsify(address.toString())}
          className="font-mono text-xs text-muted-foreground hover:text-violet-400"
        />
        <AccountButtons address={address} />
      </div>
      <div className="space-y-4">
        <AccountTokens address={address} />
        <AccountTransactions address={address} />
      </div>
    </div>
  )
}
