'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { useWallet } from '@solana/wallet-adapter-react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RoundJudgeCards } from './round-judge-cards'

function Mascot({
  className = 'h-11 w-11',
  bounce = false,
  hero = false,
  style,
}: {
  className?: string
  bounce?: boolean
  hero?: boolean
  style?: CSSProperties
}) {
  return (
    <Image
      src="/mascot.jpg"
      alt="TrustSaur"
      width={hero ? 400 : 88}
      height={hero ? 400 : 88}
      style={style}
      className={`${className} ${hero ? 'object-cover object-top' : 'rounded-full object-cover'} ${bounce ? 'animate-bounce' : ''}`}
      priority
    />
  )
}

type Stage =
  | 'idle'
  | 'checking'
  | 'no-verification-needed'
  | 'collecting'
  | 'judging'
  | 'paying'
  | 'paid'
  | 'declined'
  | 'expired'

const POLL_INTERVAL_MS = 2000
const DEFAULT_FEE_SOL = 0.02

interface CheckResult {
  needsHumanVerification: boolean
  confidence: number
  reasoning: string
  verificationQuestion?: string
  roundId?: string
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

interface PurrBreakdown {
  base: number
  speedBonus: number
  photoBonus: number
  locationBonus: number
  bonusWinnerBonus: number
}

interface RoundPayment {
  signature: string
  explorerUrl: string
  totalAmountSol: number
  recipients: { wallet: string; amountSol: number }[]
}

interface Round {
  id: string
  question: string
  feeLamports: number
  status: 'collecting' | 'judging' | 'expired' | 'resolved'
  answers: RoundAnswer[]
  bonusWinnerWallet?: string
  payment?: RoundPayment
  purrAwards?: Record<string, { amount: number; breakdown: PurrBreakdown }>
}

const MAX_VERIFIERS = 5

const EXAMPLE_ACTION =
  "Cafe Luna doesn't take online reservations — confirm they're actually open and taking walk-ins right now, then pay a $40 deposit to hold a table for 2 at 7pm tonight."

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Try again.'
}

function formatWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
}

export function TrustSaurFeature() {
  const { publicKey } = useWallet()
  const [action, setAction] = useState(EXAMPLE_ACTION)
  const [feeSol, setFeeSol] = useState(DEFAULT_FEE_SOL)
  const [photoRequired, setPhotoRequired] = useState(false)
  const [locationRequired, setLocationRequired] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [judging, setJudging] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  function pollRound(roundId: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/rounds/${roundId}`)
        const data = (await res.json()) as Round
        if (!res.ok) return

        setRound(data)
        if (data.status === 'judging') {
          stopPolling()
          setStage('judging')
        } else if (data.status === 'expired') {
          stopPolling()
          setStage('expired')
        }
      } catch {
        // Keep polling — a single failed check shouldn't kill the flow.
      }
    }, POLL_INTERVAL_MS)
  }

  useEffect(() => stopPolling, [])

  async function runAgent() {
    setStage('checking')
    setError(null)
    setCheck(null)
    setRound(null)

    try {
      const res = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          feeSol,
          askerWallet: publicKey?.toBase58(),
          proofRequirements: { photoRequired, locationRequired },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed.')

      const parsed = data as CheckResult
      setCheck(parsed)

      if (parsed.needsHumanVerification && parsed.roundId) {
        setStage('collecting')
        pollRound(parsed.roundId)
      } else {
        setStage('no-verification-needed')
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      setStage('idle')
    }
  }

  async function submitJudgments(judgments: Record<string, 'correct' | 'incorrect'>, bonusWinnerWallet?: string) {
    if (!round) return
    setJudging(true)
    setError(null)
    setStage('paying')

    try {
      const res = await fetch(`/api/rounds/${round.id}/judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ askerWallet: publicKey?.toBase58(), judgments, bonusWinnerWallet }),
      })
      const data = (await res.json()) as Round
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? 'Judging failed.')

      setRound(data)
      setStage(data.payment ? 'paid' : 'declined')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      setStage('judging')
    } finally {
      setJudging(false)
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
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-violet-500">TrustSaur</span>
      </div>

      <AnimatePresence>
        {stage === 'idle' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-violet-950/40 via-neutral-950 to-neutral-950 shadow-sm">
              <div className="relative z-10 px-6 pt-9 text-center">
                <p className="text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">
                  Before it spends your money,
                  <br />
                  it asks real humans first.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  A confidence check for autonomous agents — verified by up to 5 real people,
                  paid automatically on Solana.
                </p>
              </div>
              <div className="flex justify-center pt-4">
                <Mascot
                  hero
                  className="h-72 w-72 -mb-6 md:h-80 md:w-80 md:-mb-8"
                  style={{
                    maskImage: 'radial-gradient(closest-side, black 62%, transparent 92%)',
                    WebkitMaskImage: 'radial-gradient(closest-side, black 62%, transparent 92%)',
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="gap-3 py-4">
        <CardContent className="space-y-3">
          <label className="text-sm font-medium text-foreground">What is the agent about to do?</label>
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={stage !== 'idle'}
            className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-sm leading-relaxed transition-colors placeholder:text-muted-foreground/60 focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
          />

          {stage === 'idle' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <label htmlFor="fee-sol">Verifier fee</label>
              <input
                id="fee-sol"
                type="number"
                min={0}
                step={0.001}
                value={feeSol}
                onChange={(e) => setFeeSol(Number(e.target.value))}
                className="w-24 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-sm text-foreground focus:border-violet-500/40 focus:outline-none"
              />
              <span>SOL — split among correct verifiers (min. ~$1)</span>
            </div>
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
            <div className="flex justify-center">
              <Button
                onClick={runAgent}
                size="sm"
                className="h-12 w-[320px] max-w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white shadow-sm hover:from-violet-400 hover:to-fuchsia-400"
              >
                Let agent proceed
              </Button>
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

          {stage === 'no-verification-needed' && check && (
            <motion.div key="no-verification" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="py-4">
                <CardContent className="flex items-start gap-3">
                  <Mascot className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-violet-500">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Approved automatically — no human verification needed
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

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                    {answersCount} of {MAX_VERIFIERS} verifiers answered
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(stage === 'judging' || stage === 'paying') && round && (
            <motion.div key="judging" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="py-4">
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">
                    {round.answers.length} answers are in — mark each one and pick a standout for a bonus
                  </p>
                  <RoundJudgeCards answers={round.answers} onSubmit={submitJudgments} submitting={judging} />
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
                  <p className="text-xs text-muted-foreground">Try asking again — verifier availability varies.</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'declined' && (
            <motion.div key="declined" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-red-500/30 bg-red-500/5 py-4">
                <CardContent className="flex items-center gap-2 text-sm font-medium text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  No answer was judged correct — agent will not spend any money.
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'paid' && round?.payment && (
            <motion.div key="paid" initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
              <Card className="border-violet-500/40 bg-violet-500/5 py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Payment sent — {round.payment.totalAmountSol} SOL split across {round.payment.recipients.length}{' '}
                    verifier{round.payment.recipients.length === 1 ? '' : 's'}
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
                      const purr = round.purrAwards?.[r.wallet]
                      const isBonus = r.wallet === round.bonusWinnerWallet
                      return (
                        <div
                          key={r.wallet}
                          className="flex items-center gap-2 rounded-md bg-black/20 p-2"
                        >
                          <Image
                            src="/token/purr-512.jpg"
                            alt="$PURR"
                            width={24}
                            height={24}
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                          />
                          <div className="flex-1 space-y-0.5">
                            <div className="text-xs font-medium text-violet-500">
                              {formatWallet(r.wallet)} {isBonus && '⭐'} — {r.amountSol} SOL
                              {purr && ` + ${purr.amount} $PURR`}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
