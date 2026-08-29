'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { RefreshCw, ArrowDownLeft, ArrowUpRight, Coins, Copy, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useCluster } from '../cluster/cluster-data-access'
import { ExplorerLink } from '../cluster/cluster-ui'
import {
  useGetBalance,
  useGetSignatures,
  useGetTokenAccounts,
  useRequestAirdrop,
  useTransferSol,
} from './account-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AppAlert } from '@/components/app-alert'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AppModal } from '@/components/app-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AccountBalance({ address }: { address: PublicKey }) {
  const query = useGetBalance({ address })

  return (
    <button
      onClick={() => query.refetch()}
      className="group flex items-baseline gap-2 text-left"
      aria-label="Refresh balance"
    >
      <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent transition-opacity group-hover:opacity-80">
        {query.data !== undefined ? <BalanceSol balance={query.data} /> : '…'}
      </span>
      <span className="text-lg font-medium text-muted-foreground">SOL</span>
    </button>
  )
}

export function AccountChecker() {
  const { publicKey } = useWallet()
  if (!publicKey) {
    return null
  }
  return <AccountBalanceCheck address={publicKey} />
}

export function AccountBalanceCheck({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  const mutation = useRequestAirdrop({ address })
  const query = useGetBalance({ address })

  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return (
      <AppAlert
        action={
          <Button
            variant="outline"
            className="border-white/10 hover:bg-white/10"
            onClick={() => mutation.mutateAsync(1).catch((err) => console.log(err))}
          >
            Request Airdrop
          </Button>
        }
      >
        You are connected to <strong>{cluster.name}</strong> but your account is not found on this cluster.
      </AppAlert>
    )
  }
  return null
}

export function AccountButtons({ address }: { address: PublicKey }) {
  const { cluster } = useCluster()
  const { publicKey } = useWallet()
  // Send debits `address` itself (see useTransferSol / createTransaction), not
  // whichever wallet happens to be connected — showing it on someone else's
  // account page offered a control that could only ever fail to sign.
  const isOwnAccount = Boolean(publicKey && publicKey.equals(address))

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {cluster.network?.includes('mainnet') ? null : <ModalAirdrop address={address} />}
      {isOwnAccount && <ModalSend address={address} />}
      <ModalReceive address={address} />
    </div>
  )
}

export function AccountTokens({ address }: { address: PublicKey }) {
  const [showAll, setShowAll] = useState(false)
  const query = useGetTokenAccounts({ address })
  const client = useQueryClient()
  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-violet-500">
            <Coins className="h-4 w-4" />
            Token accounts
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            disabled={query.isLoading}
            onClick={async () => {
              await query.refetch()
              await client.invalidateQueries({ queryKey: ['getTokenAccountBalance'] })
            }}
          >
            <RefreshCw className={`h-4 w-4 ${query.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {query.isError && <p className="text-sm text-red-400">Error: {query.error?.message.toString()}</p>}
        {query.isSuccess && (
          <>
            {query.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No token accounts found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead>Public key</TableHead>
                    <TableHead>Mint</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map(({ account, pubkey }) => (
                    <TableRow key={pubkey.toString()} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-mono text-xs">
                        <ExplorerLink label={ellipsify(pubkey.toString())} path={`account/${pubkey.toString()}`} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <ExplorerLink
                          label={ellipsify(account.data.parsed.info.mint)}
                          path={`account/${account.data.parsed.info.mint.toString()}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {account.data.parsed.info.tokenAmount.uiAmount}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(query.data?.length ?? 0) > 5 && (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={3} className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-violet-400 hover:bg-white/10 hover:text-violet-300"
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll ? 'Show less' : 'Show all'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function AccountTransactions({ address }: { address: PublicKey }) {
  const query = useGetSignatures({ address })
  const [showAll, setShowAll] = useState(false)

  const items = useMemo(() => {
    if (showAll) return query.data
    return query.data?.slice(0, 5)
  }, [query.data, showAll])

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-violet-500">Transaction history</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            disabled={query.isLoading}
            onClick={() => query.refetch()}
          >
            <RefreshCw className={`h-4 w-4 ${query.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {query.isError && <p className="text-sm text-red-400">Error: {query.error?.message.toString()}</p>}
        {query.isSuccess && (
          <>
            {query.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead>Signature</TableHead>
                    <TableHead className="text-right">Slot</TableHead>
                    <TableHead>Block time</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.signature} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-mono text-xs">
                        <ExplorerLink path={`tx/${item.signature}`} label={ellipsify(item.signature, 8)} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <ExplorerLink path={`block/${item.slot}`} label={item.slot.toString()} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date((item.blockTime ?? 0) * 1000).toISOString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.err ? (
                          <span className="text-xs font-medium text-red-400" title={item.err.toString()}>
                            Failed
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-400">Success</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(query.data?.length ?? 0) > 5 && (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={4} className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-violet-400 hover:bg-white/10 hover:text-violet-300"
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll ? 'Show less' : 'Show all'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BalanceSol({ balance }: { balance: number }) {
  return <span>{Math.round((balance / LAMPORTS_PER_SOL) * 100000) / 100000}</span>
}

function ModalReceive({ address }: { address: PublicKey }) {
  const [copied, setCopied] = useState(false)
  const fullAddress = address.toString()

  async function copyAddress() {
    await navigator.clipboard.writeText(fullAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <AppModal
      title="Receive"
      trigger={
        <Button
          variant="outline"
          className="h-10 gap-1.5 rounded-full border-white/10 bg-white/5 hover:bg-white/10"
        >
          <ArrowDownLeft className="h-4 w-4" />
          Receive
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">Receive assets by sending them to your public key:</p>
      <button
        onClick={copyAddress}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-left font-mono text-xs break-all transition-colors hover:border-violet-500/40"
      >
        <span>{fullAddress}</span>
        {copied ? (
          <Check className="h-4 w-4 shrink-0 text-violet-400" />
        ) : (
          <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
    </AppModal>
  )
}

function ModalAirdrop({ address }: { address: PublicKey }) {
  const mutation = useRequestAirdrop({ address })
  const [amount, setAmount] = useState('2')

  return (
    <AppModal
      title="Airdrop"
      trigger={
        <Button
          variant="outline"
          className="h-10 gap-1.5 rounded-full border-white/10 bg-white/5 hover:bg-white/10"
        >
          <Coins className="h-4 w-4" />
          Airdrop
        </Button>
      }
      submitDisabled={!amount || mutation.isPending}
      submitLabel={mutation.isPending ? 'Requesting…' : 'Request Airdrop'}
      submit={() => mutation.mutateAsync(parseFloat(amount))}
    >
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}

function ModalSend({ address }: { address: PublicKey }) {
  const wallet = useWallet()
  const mutation = useTransferSol({ address })
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('1')

  if (!address || !wallet.sendTransaction) {
    return (
      <Button variant="outline" disabled className="h-10 gap-1.5 rounded-full border-white/10 bg-white/5">
        <ArrowUpRight className="h-4 w-4" />
        Send
      </Button>
    )
  }

  return (
    <AppModal
      title="Send"
      trigger={
        <Button className="h-10 gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400">
          <ArrowUpRight className="h-4 w-4" />
          Send
        </Button>
      }
      submitDisabled={!destination || !amount || mutation.isPending}
      submitLabel={mutation.isPending ? 'Sending…' : 'Send'}
      submit={() => {
        mutation.mutateAsync({
          destination: new PublicKey(destination),
          amount: parseFloat(amount),
        })
      }}
    >
      <Label htmlFor="destination">Destination</Label>
      <Input
        disabled={mutation.isPending}
        id="destination"
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination"
        type="text"
        value={destination}
      />
      <Label htmlFor="amount">Amount</Label>
      <Input
        disabled={mutation.isPending}
        id="amount"
        min="1"
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        step="any"
        type="number"
        value={amount}
      />
    </AppModal>
  )
}
