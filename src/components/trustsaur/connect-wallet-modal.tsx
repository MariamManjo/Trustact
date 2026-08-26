'use client'

import { useEffect, useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base'
import { ArrowLeft, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'list' | 'connecting'

interface WalletEntry {
  name: string
  adapterName: WalletName | null
  icon: string | null
  installUrl: string
  installed: boolean
  label: 'Detected' | 'Popular' | null
}

// Curated order per spec — detected wallets float to the top, but this base
// order (and the install links for anything not detected) stays fixed.
const CURATED_WALLETS: { name: string; installUrl: string; popular?: boolean }[] = [
  { name: 'Phantom', installUrl: 'https://phantom.app/download', popular: true },
  { name: 'Solflare', installUrl: 'https://solflare.com/download' },
  { name: 'Backpack', installUrl: 'https://backpack.app/downloads' },
  { name: 'Coinbase Wallet', installUrl: 'https://www.coinbase.com/wallet/downloads' },
  { name: 'Trust', installUrl: 'https://trustwallet.com/download' },
]

function firstWord(name: string): string {
  return name.toLowerCase().split(' ')[0]
}

function WalletIcon({ entry }: { entry: WalletEntry }) {
  if (entry.icon) {
    // eslint-disable-next-line @next/next/no-img-element -- wallet adapter icons are data: URIs
    return <img src={entry.icon} alt="" className="h-8 w-8 shrink-0 rounded-full" />
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-muted-foreground">
      {entry.name.charAt(0)}
    </div>
  )
}

export function ConnectWalletModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { wallets, wallet, select, connect } = useWallet()

  const [search, setSearch] = useState('')
  const [pendingWalletName, setPendingWalletName] = useState<WalletName | null>(null)
  const [connectingLabel, setConnectingLabel] = useState<{ name: string; icon: string | null } | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)

  // Derived, not stored — 'connecting' is just "we've picked a wallet and
  // are waiting on it", so there's nothing to desync.
  const step: Step = pendingWalletName ? 'connecting' : 'list'

  // Reset to a clean slate every time the modal opens (render-time state
  // adjustment on a prop change, not an effect — avoids an extra render).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSearch('')
      setPendingWalletName(null)
      setInlineError(null)
    }
  }

  const entries: WalletEntry[] = useMemo(() => {
    const detected = wallets.filter((w) => w.readyState === WalletReadyState.Installed)
    const findDetected = (name: string) =>
      detected.find((w) => w.adapter.name.toLowerCase() === name.toLowerCase()) ??
      detected.find((w) => w.adapter.name.toLowerCase().includes(firstWord(name)))

    const curated: WalletEntry[] = CURATED_WALLETS.map((curated) => {
      const match = findDetected(curated.name)
      return {
        name: curated.name,
        adapterName: match?.adapter.name ?? null,
        icon: match?.adapter.icon ?? null,
        installUrl: curated.installUrl,
        installed: Boolean(match),
        label: match ? 'Detected' : curated.popular ? 'Popular' : null,
      }
    })

    const curatedNames = new Set(CURATED_WALLETS.map((c) => firstWord(c.name)))
    const extra: WalletEntry[] = detected
      .filter((w) => !curatedNames.has(firstWord(w.adapter.name)))
      .map((w) => ({
        name: w.adapter.name,
        adapterName: w.adapter.name,
        icon: w.adapter.icon,
        installUrl: w.adapter.url,
        installed: true,
        label: 'Detected',
      }))

    const all = [...curated, ...extra]
    return [...all.filter((e) => e.installed), ...all.filter((e) => !e.installed)]
  }, [wallets])

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.name.toLowerCase().includes(q))
  }, [entries, search])

  // Drives the actual connect() call once `select()` has propagated the
  // chosen adapter into wallet-adapter-react's own state.
  useEffect(() => {
    if (!pendingWalletName) return
    if (wallet?.adapter.name !== pendingWalletName) return

    let cancelled = false

    const timeoutId = setTimeout(() => {
      if (cancelled) return
      cancelled = true
      setPendingWalletName(null)
      setInlineError('Connection timed out — try again.')
    }, 25000)

    connect()
      .then(() => {
        if (cancelled) return
        clearTimeout(timeoutId)
        setPendingWalletName(null)
        onOpenChange(false)
      })
      .catch(() => {
        if (cancelled) return
        clearTimeout(timeoutId)
        setPendingWalletName(null)
        setInlineError('Connection cancelled — try again.')
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect() identity changes with `wallet`, which we're already keying on
  }, [wallet, pendingWalletName])

  function handleSelectEntry(entry: WalletEntry) {
    if (!entry.installed || !entry.adapterName) {
      window.open(entry.installUrl, '_blank', 'noopener,noreferrer')
      return
    }
    setInlineError(null)
    setConnectingLabel({ name: entry.name, icon: entry.icon })
    setPendingWalletName(entry.adapterName)
    select(entry.adapterName)
  }

  function handleCancelConnecting() {
    setPendingWalletName(null)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <DialogPrimitive.Title className="sr-only">
            {step === 'list' ? 'Connect your wallet' : 'Connecting'}
          </DialogPrimitive.Title>

          <div className="flex items-center px-4 py-4">
            <div className="flex w-8 justify-start">
              {step === 'connecting' && (
                <button
                  onClick={handleCancelConnecting}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex-1 text-center text-sm font-medium">
              {step === 'list' ? 'Connect your wallet' : 'Connecting'}
            </div>
            <div className="flex w-8 justify-end">
              <DialogPrimitive.Close
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {step === 'list' && (
            <div className="px-4 pb-4">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search wallets"
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-violet-500/50"
                />
              </div>

              {inlineError && (
                <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{inlineError}</div>
              )}

              <div className="space-y-1">
                {filteredEntries.map((entry) => (
                  <button
                    key={entry.name}
                    onClick={() => handleSelectEntry(entry)}
                    className="flex h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-white/5"
                  >
                    <WalletIcon entry={entry} />
                    <span className="flex-1 text-sm font-medium">{entry.name}</span>
                    <span
                      className={cn(
                        'text-xs',
                        entry.installed ? 'text-violet-400' : 'text-muted-foreground'
                      )}
                    >
                      {entry.installed ? entry.label : 'Install'}
                    </span>
                  </button>
                ))}

                {filteredEntries.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No wallets found.</p>
                )}
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                By continuing, you agree to our Terms &amp; Privacy.
              </p>
            </div>
          )}

          {step === 'connecting' && connectingLabel && (
            <div className="flex flex-col items-center gap-5 px-6 pb-10 pt-4">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <WalletIcon entry={{ ...connectingLabel, adapterName: null, installUrl: '', installed: true, label: null }} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Confirm in your wallet</p>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
