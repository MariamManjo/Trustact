'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base'
import {
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { ArrowLeft, Backpack, ChevronRight, Search, X } from 'lucide-react'

// Icon source only — these instances are never passed to WalletProvider, so
// they can't affect the actual connect flow. They exist purely to read the
// bundled logo each package carries, for the not-yet-installed state where
// Wallet Standard has nothing to offer (a wallet only has an icon to give
// once it actually injects itself).
const FALLBACK_ICONS: Record<string, string | null> = {
  Phantom: new PhantomWalletAdapter().icon,
  Solflare: new SolflareWalletAdapter().icon,
  'Coinbase Wallet': new CoinbaseWalletAdapter().icon,
  Trust: new TrustWalletAdapter().icon,
}

type Step = 'list' | 'connecting'

interface WalletEntry {
  name: string
  adapterName: WalletName | null
  icon: string | null
  installUrl: string
  installed: boolean
  label: 'Detected' | 'Popular' | null
  mobileDeepLink?: () => string
}

/**
 * Mobile browsers have no extension mechanism, so a wallet extension can
 * never "inject" itself the way it does on desktop — there's nothing for
 * wallet-adapter to detect, even with the app genuinely installed. These
 * universal links open (or install-then-open) the wallet's own in-app
 * browser pointed at this page, where the wallet *can* inject a provider.
 */
function mobileDeepLink(builder: (url: string, ref: string) => string): (() => string) | undefined {
  if (typeof window === 'undefined') return undefined
  return () => builder(encodeURIComponent(window.location.href), encodeURIComponent(window.location.origin))
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// Curated order per spec — detected wallets float to the top, but this base
// order (and the install links for anything not detected) stays fixed.
const CURATED_WALLETS: {
  name: string
  installUrl: string
  popular?: boolean
  mobileDeepLink?: () => string
}[] = [
  {
    name: 'Phantom',
    installUrl: 'https://phantom.app/download',
    popular: true,
    mobileDeepLink: mobileDeepLink((url, ref) => `https://phantom.app/ul/browse/${url}?ref=${ref}`),
  },
  {
    name: 'Solflare',
    installUrl: 'https://solflare.com/download',
    mobileDeepLink: mobileDeepLink((url, ref) => `https://solflare.com/ul/v1/browse/${url}?ref=${ref}`),
  },
  { name: 'Backpack', installUrl: 'https://backpack.app/downloads' },
  { name: 'Coinbase Wallet', installUrl: 'https://www.coinbase.com/wallet/downloads' },
  { name: 'Trust', installUrl: 'https://trustwallet.com/download' },
]

function firstWord(name: string): string {
  return name.toLowerCase().split(' ')[0]
}

function isLikelyUserRejection(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('reject') || m.includes('declin') || m.includes('cancel') || m.includes('denied')
}

function walletErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message) return err.message
    // Wallet adapter errors (WalletNotConnectedError, etc.) often ship
    // with an empty .message — the class name is the useful signal.
    if (err.name && err.name !== 'Error') {
      return err.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Error$/, '').trim()
    }
  }
  return 'Connection cancelled. Try again.'
}

function WalletIcon({ entry }: { entry: WalletEntry }) {
  if (entry.icon) {
    // eslint-disable-next-line @next/next/no-img-element -- wallet adapter icons are data: URIs
    return <img src={entry.icon} alt="" className="h-8 w-8 shrink-0 rounded-full" />
  }
  // Backpack has no legacy wallet-adapter package (it's Wallet Standard-only,
  // so there's nothing to pull a bundled icon from until it's actually
  // installed and injects itself) — a real vector icon reads much better
  // than a plain letter-in-a-circle for the not-installed state.
  if (entry.name === 'Backpack') {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <Backpack className="h-4.5 w-4.5" />
      </div>
    )
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
  const connectAttemptRef = useRef<WalletName | null>(null)
  const retriedRef = useRef(false)
  const pendingWalletNameRef = useRef<WalletName | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onOpenChangeRef = useRef(onOpenChange)

  useLayoutEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  useLayoutEffect(() => {
    pendingWalletNameRef.current = pendingWalletName
  }, [pendingWalletName])

  useEffect(() => {
    if (!open) {
      connectAttemptRef.current = null
      retriedRef.current = false
      pendingWalletNameRef.current = null
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

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
    // Installed = extension injected. Loadable = always-available runtimes
    // (Solana Mobile Wallet Adapter on phones). Skipping Loadable made
    // mobile look like "no wallet" even though MWA was sitting right there.
    const detected = wallets.filter(
      (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable
    )
    const findDetected = (name: string) =>
      detected.find((w) => w.adapter.name.toLowerCase() === name.toLowerCase()) ??
      detected.find((w) => w.adapter.name.toLowerCase().includes(firstWord(name)))

    const curated: WalletEntry[] = CURATED_WALLETS.map((curated) => {
      const match = findDetected(curated.name)
      return {
        name: curated.name,
        adapterName: match?.adapter.name ?? null,
        icon: match?.adapter.icon ?? FALLBACK_ICONS[curated.name] ?? null,
        installUrl: curated.installUrl,
        installed: Boolean(match),
        label: match ? 'Detected' : curated.popular ? 'Popular' : null,
        mobileDeepLink: curated.mobileDeepLink,
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

  const selectedName = wallet?.adapter.name ?? null

  // Drives the actual connect() call once `select()` has propagated the
  // chosen adapter into wallet-adapter-react's own state. Keyed on the
  // adapter *name*, not the `wallet` object — that object is recreated
  // whenever the adapter list rebuilds, and the previous cleanup was
  // treating that as a cancel, which dropped a successful connect() on
  // the floor and left the modal stuck on "Confirm in your wallet".
  useEffect(() => {
    if (!pendingWalletName) return
    if (selectedName !== pendingWalletName) return
    if (connectAttemptRef.current === pendingWalletName) return
    connectAttemptRef.current = pendingWalletName

    const attemptName = pendingWalletName

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (pendingWalletNameRef.current !== attemptName) return
      setPendingWalletName(null)
      setInlineError('Connection timed out. Try again.')
    }, 25000)

    const stillThisAttempt = () => pendingWalletNameRef.current === attemptName

    const succeed = () => {
      if (!stillThisAttempt()) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setPendingWalletName(null)
      onOpenChangeRef.current(false)
    }

    const fail = (err: unknown) => {
      if (!stillThisAttempt()) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setPendingWalletName(null)
      setInlineError(walletErrorMessage(err))
    }

    connect()
      .then(succeed)
      .catch(async (err: unknown) => {
        if (!stillThisAttempt()) return
        const message = walletErrorMessage(err)
        // Some wallet extensions (observed with Phantom) occasionally throw
        // a generic, transient error on the very first connect() call after
        // page load. wallet-adapter also deselects the wallet on any
        // connect error, so the retry has to select() again before
        // connect() — otherwise it throws WalletNotSelectedError and
        // looks like the wallet never connected.
        if (retriedRef.current || isLikelyUserRejection(message)) {
          fail(err)
          return
        }
        retriedRef.current = true
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (!stillThisAttempt()) return
        select(attemptName)
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (!stillThisAttempt()) return
        connect().then(succeed).catch(fail)
      })
    // Do not cancel the in-flight connect on cleanup — a wallet-object
    // identity change used to swallow a connect that had already succeeded.
    // Timeout is cleared when the modal closes (see the `open` effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect()/select identity changes with the selected adapter, which we're already keying on via selectedName
  }, [selectedName, pendingWalletName])

  function handleSelectEntry(entry: WalletEntry) {
    if (!entry.installed || !entry.adapterName) {
      // On mobile there's no extension to detect even when the app is
      // installed — a universal link opens (or installs, then opens) the
      // wallet's own in-app browser pointed back at this page instead of
      // just sending them to a store listing.
      const url = isMobileDevice() && entry.mobileDeepLink ? entry.mobileDeepLink() : entry.installUrl
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setInlineError(null)
    connectAttemptRef.current = null
    retriedRef.current = false
    pendingWalletNameRef.current = entry.adapterName
    setConnectingLabel({ name: entry.name, icon: entry.icon })
    setPendingWalletName(entry.adapterName)
    select(entry.adapterName)
  }

  function handleCancelConnecting() {
    connectAttemptRef.current = null
    retriedRef.current = false
    pendingWalletNameRef.current = null
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
              <p className="mb-3 text-center text-xs text-muted-foreground">
                By connecting a wallet, you agree to our{' '}
                <a href="#" className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
                  Terms of Service
                </a>
                .
              </p>

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

              <div className="space-y-2">
                {filteredEntries.map((entry) => (
                  <button
                    key={entry.name}
                    onClick={() => handleSelectEntry(entry)}
                    className="flex h-14 w-full items-center gap-3 rounded-xl border border-white/10 px-3 text-left transition-colors hover:border-white/20 hover:bg-white/5"
                  >
                    <WalletIcon entry={entry} />
                    <span className="flex-1 text-sm font-medium">{entry.name}</span>
                    {entry.installed && entry.label && (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-400">
                        {entry.label}
                      </span>
                    )}
                    {!entry.installed && (
                      <span className="text-xs text-muted-foreground">
                        {entry.mobileDeepLink && isMobileDevice() ? 'Open' : 'Install'}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}

                {filteredEntries.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No wallets found.</p>
                )}
              </div>
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
