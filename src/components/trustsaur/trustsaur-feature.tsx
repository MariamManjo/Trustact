'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatTimeRemaining } from '@/lib/utils'
import { LandingPitch } from './landing-pitch'
import { LocationMap } from './location-map'
import { ConnectWalletModal } from './connect-wallet-modal'
import { useDepositToRound } from './escrow-data-access'
import { WINDOW_PRESETS } from '@/lib/verification-window'
import Link from 'next/link'

const FALLBACK_FEE_LAMPORTS = 0.02 * LAMPORTS_PER_SOL

function Mascot({ className = 'h-11 w-11', bounce = false }: { className?: string; bounce?: boolean }) {
  return (
    <Image
      src="/mascot.png"
      alt="Trustact"
      width={88}
      height={88}
      className={`${className} object-contain ${bounce ? 'animate-bounce' : ''}`}
      priority
    />
  )
}

type Stage =
  | 'idle'
  | 'checking'
  | 'depositing'
  | 'no-verification-needed'
  | 'collecting'
  | 'settling'
  | 'resolved'
  | 'expired'

const POLL_INTERVAL_MS = 2000

interface CheckResult {
  needsHumanVerification: boolean
  confidence: number
  reasoning: string
  verificationQuestion?: string
  feeLamports?: number
}

interface RoundAnswer {
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
  submittedAt: number
  withinHalfWindow: boolean
  judgment?: 'correct' | 'incorrect'
  photoUrl?: string
  location?: { lat: number; lng: number; mapUrl: string }
}

interface PointsBreakdown {
  base: number
  speedBonus: number
  photoBonus: number
  locationBonus: number
}

interface RoundPayment {
  signature: string
  explorerUrl: string
  totalAmountSol: number
  recipients: { wallet: string; amountSol: number }[]
}

type ResolutionKind = 'unanimous' | 'majority' | 'tie' | 'solo' | 'refund'

interface Round {
  id: string
  question: string
  status: 'collecting' | 'judging' | 'settling' | 'expired' | 'resolved'
  answers: RoundAnswer[]
  resolutionKind?: ResolutionKind
  payment?: RoundPayment
  points?: Record<string, { amount: number; breakdown: PointsBreakdown }>
  closesAt: number
}

const MAX_VERIFIERS = 5

const EXAMPLE_ACTION =
  "Cafe Luna doesn't take online reservations. Confirm they're actually open and taking walk-ins right now, then pay a $40 deposit to hold a table for 2 at 7pm tonight."

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Try again.'
}

function formatWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
}

export function TrustactFeature() {
  const { publicKey } = useWallet()
  const depositToRound = useDepositToRound()
  const [action, setAction] = useState(EXAMPLE_ACTION)
  const [photoRequired, setPhotoRequired] = useState(false)
  const [locationRequired, setLocationRequired] = useState(false)
  const [windowSeconds, setWindowSeconds] = useState<number>(WINDOW_PRESETS[0].seconds)
  const [stage, setStage] = useState<Stage>('idle')
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  // No asker judging step — a closed round settles itself by consensus
  // server-side, so polling just watches for that to land.
  function pollRound(roundId: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/rounds/${roundId}`)
        const data = (await res.json()) as Round
        if (!res.ok) return

        setRound(data)
        if (data.status === 'judging' || data.status === 'settling') {
          setStage('settling')
        } else if (data.status === 'resolved') {
          stopPolling()
          setStage('resolved')
        } else if (data.status === 'expired') {
          // Transient — the backend refunds the asker's deposit automatically
          // on the next read of an expired round, so keep polling for that.
          setStage('expired')
        }
      } catch {
        // Keep polling — a single failed check shouldn't kill the flow.
      }
    }, POLL_INTERVAL_MS)
  }

  useEffect(() => stopPolling, [])

  async function runAgent() {
    if (!publicKey) {
      setWalletModalOpen(true)
      return
    }
    setStage('checking')
    setError(null)
    setCheck(null)
    setRound(null)

    try {
      const assessRes = await fetch('/api/rounds/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const assessData = await assessRes.json()
      if (!assessRes.ok) throw new Error(assessData.error ?? 'Verification failed.')

      const parsed = assessData as CheckResult
      setCheck(parsed)

      if (!parsed.needsHumanVerification) {
        setStage('no-verification-needed')
        return
      }

      setStage('depositing')
      const roundId = crypto.randomUUID()
      const feeLamports = parsed.feeLamports ?? FALLBACK_FEE_LAMPORTS
      const depositSignature = await depositToRound(roundId, feeLamports)

      const createRes = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId,
          action,
          question: parsed.verificationQuestion,
          askerWallet: publicKey.toBase58(),
          depositSignature,
          proofRequirements: { photoRequired, locationRequired },
          windowSeconds,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error ?? 'Could not open this round.')

      setStage('collecting')
      pollRound(roundId)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      setStage('idle')
    }
  }

  function reset() {
    stopPolling()
    setStage('idle')
    setCheck(null)
    setRound(null)
    setError(null)
  }

  const answersCount = round?.answers.length ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-10">
      <AnimatePresence>
        {stage === 'idle' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <LandingPitch />
          </motion.div>
        )}
      </AnimatePresence>

      <Card id="agent-action-form" className={`gap-3 py-4 ${stage === 'idle' ? '-mt-8' : ''}`}>
        <CardContent className="space-y-3">
          <label className="text-sm font-medium text-foreground">What is the agent about to do?</label>
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={stage !== 'idle'}
            className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-relaxed transition-colors placeholder:text-muted-foreground/60 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
          />

          {stage === 'idle' && (
            <p className="text-xs text-muted-foreground">
              Costs a small SOL deposit to ask, starting around $1. That deposit is the pool. Up to 5 people
              answer for free, correct and fastest answers split it, resolved by consensus with no self-judging.
            </p>
          )}

          {stage === 'idle' && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={photoRequired}
                  onChange={(e) => setPhotoRequired(e.target.checked)}
                  className="accent-violet-500"
                />
                Require photo proof
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={locationRequired}
                  onChange={(e) => setLocationRequired(e.target.checked)}
                  className="accent-violet-500"
                />
                Require location
              </label>
            </div>
          )}

          {stage === 'idle' && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">How long should verifiers have to answer?</p>
              <div className="flex gap-1.5">
                {WINDOW_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => setWindowSeconds(preset.seconds)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      windowSeconds === preset.seconds
                        ? 'bg-violet-500 text-white'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/70">
                If nobody answers by then, your deposit is refunded automatically.
              </p>
            </div>
          )}

          {stage === 'idle' && (
            <div className="flex justify-center">
              <Button
                onClick={runAgent}
                size="sm"
                disabled={!action.trim()}
                className="h-12 w-[320px] max-w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white shadow-sm hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50"
              >
                {publicKey ? 'Let agent proceed' : 'Connect wallet to ask'}
              </Button>
              <ConnectWalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
            </div>
          )}
          {stage !== 'idle' && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={reset} className="h-12 w-[320px] max-w-full font-medium">
                Reset demo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="min-h-[160px]">
        <AnimatePresence mode="wait">
          {stage === 'checking' && (
            <motion.div key="checking" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="py-4">
                <CardContent className="flex items-center gap-3">
                  <Mascot className="h-10 w-10 rounded-full" bounce />
                  <p className="text-sm text-muted-foreground">
                    Checking whether I actually know this, or need to ask real people…
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'depositing' && (
            <motion.div key="depositing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="py-4">
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Mascot className="h-10 w-10 rounded-full" bounce />
                    <p className="text-sm text-muted-foreground">Confirm the deposit in your wallet to open this round…</p>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Your wallet may show a security warning first, since it&apos;s a direct SOL deposit to a new
                    program address. That&apos;s expected on a devnet app, not a sign anything is wrong.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'no-verification-needed' && check && (
            <motion.div key="no-verification" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="py-4">
                <CardContent className="flex items-start gap-3">
                  <Mascot className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-violet-500">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Approved automatically, no human verification needed
                    </p>
                    <p className="text-sm text-muted-foreground">{check.reasoning}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'collecting' && check && round && (
            <motion.div key="collecting" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mascot className="h-10 w-10 shrink-0 rounded-full" />
                    <p className="text-sm text-muted-foreground">{check.reasoning}</p>
                  </div>

                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                    <p className="mb-1 text-xs font-medium tracking-wide text-amber-500 uppercase">
                      Asking up to {MAX_VERIFIERS} real humans to verify
                    </p>
                    <p className="text-sm font-medium">{check.verificationQuestion}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                      </span>
                      {answersCount} of {MAX_VERIFIERS} verifiers answered · {formatTimeRemaining(round.closesAt)}
                    </span>
                    <Link
                      href="/verify"
                      className="font-medium text-violet-400 underline-offset-2 hover:underline"
                    >
                      Answer on Verify →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'settling' && round && (
            <motion.div key="settling" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="py-4">
                <CardContent className="flex items-center gap-3">
                  <Mascot className="h-10 w-10 rounded-full" bounce />
                  <p className="text-sm text-muted-foreground">
                    {round.answers.length} answers in, settling by consensus. No one judges their own round…
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'expired' && (
            <motion.div key="expired" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-amber-500/30 bg-amber-500/5 py-4">
                <CardContent className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-amber-500">
                    <Clock className="h-4 w-4 shrink-0" />
                    Nobody answered in time
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Refunding your deposit now, verifier availability varies. This closes out automatically.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'resolved' && round?.payment && (
            <motion.div key="resolved" initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
              <Card className="border-violet-500/40 bg-violet-500/5 py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {round.resolutionKind === 'majority'
                      ? `Majority resolved: ${round.payment.totalAmountSol} SOL split by speed across ${round.payment.recipients.length} correct verifier${round.payment.recipients.length === 1 ? '' : 's'}`
                      : round.resolutionKind === 'refund'
                        ? `Nobody answered in time — your ${round.payment.totalAmountSol} SOL deposit was refunded`
                        : `${round.resolutionKind === 'solo' ? 'Solo answer' : round.resolutionKind === 'tie' ? 'No clear majority' : 'Unanimous'}, full pool split by speed with no platform cut`}
                  </div>
                  <p className="rounded-md bg-black/20 p-2 font-mono text-xs break-all text-muted-foreground">
                    {round.payment.signature}
                  </p>
                  <a
                    href={round.payment.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-violet-500 underline-offset-2 hover:underline"
                  >
                    View real transaction on Solana Explorer
                    <ArrowUpRight className="h-3 w-3" />
                  </a>

                  <div className="space-y-1.5">
                    {round.payment.recipients.map((r) => {
                      const award = round.points?.[r.wallet]
                      const answer = round.answers.find((a) => a.verifierWallet === r.wallet)
                      const chips = award
                        ? [
                            award.breakdown.speedBonus > 0 ? `+${award.breakdown.speedBonus} speed` : null,
                            award.breakdown.photoBonus > 0 ? `+${award.breakdown.photoBonus} photo` : null,
                            award.breakdown.locationBonus > 0 ? `+${award.breakdown.locationBonus} location` : null,
                          ].filter(Boolean)
                        : []
                      return (
                        <div key={r.wallet} className="rounded-md bg-black/20 p-2">
                          <div className="flex-1 space-y-0.5">
                            <div className="text-xs font-medium text-violet-500">
                              {formatWallet(r.wallet)}: {r.amountSol} SOL
                              {award && ` · ${award.amount} pts`}
                            </div>
                            {chips.length > 0 && (
                              <div className="text-[11px] text-muted-foreground">{chips.join(' · ')}</div>
                            )}
                            {answer?.note && (
                              <div className="pt-1 text-[11px] text-muted-foreground">&ldquo;{answer.note}&rdquo;</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {round.answers.some((a) => a.photoUrl) && (
                    <div className="space-y-1.5 border-t border-white/10 pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Photo proof</p>
                      {round.answers
                        .filter((a) => a.photoUrl)
                        .map((a) => (
                          <div key={a.verifierWallet} className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">{formatWallet(a.verifierWallet)}</p>
                            <div className="relative h-48 w-full overflow-hidden rounded-md">
                              <Image src={a.photoUrl!} alt={`Photo proof from ${formatWallet(a.verifierWallet)}`} fill className="object-cover" />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {round.answers.some((a) => a.location) && (
                    <div className="space-y-1.5 border-t border-white/10 pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Location proof</p>
                      {round.answers
                        .filter((a) => a.location)
                        .map((a) => (
                          <div key={a.verifierWallet} className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">{formatWallet(a.verifierWallet)}</p>
                            <LocationMap lat={a.location!.lat} lng={a.location!.lng} />
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-red-500/30 bg-red-500/10 py-4">
                <CardContent className="flex items-start gap-2 text-sm text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
