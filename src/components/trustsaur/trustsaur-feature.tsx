'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
  | 'awaiting-human'
  | 'timed-out'
  | 'verified'
  | 'declined'
  | 'proceeding'
  | 'paid'

const VERIFIER_TIMEOUT_SECONDS = 90
const POLL_INTERVAL_MS = 1500

interface VerifyResult {
  needsHumanVerification: boolean
  confidence: number
  reasoning: string
  verificationQuestion: string
  requestId?: string
  liveVerifier?: boolean
}

interface PayResult {
  signature: string
  explorerUrl: string
  verifier: string
  amountSol: number
}

const EXAMPLE_ACTION =
  "Cafe Luna doesn't take online reservations — confirm they're actually open and taking walk-ins right now, then pay a $40 deposit to hold a table for 2 at 7pm tonight."

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Try again.'
}

export function TrustSaurFeature() {
  const [action, setAction] = useState(EXAMPLE_ACTION)
  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verifierAnswer, setVerifierAnswer] = useState<'yes' | 'no' | null>(null)
  const [verifiedBy, setVerifiedBy] = useState<string | null>(null)
  const [payment, setPayment] = useState<PayResult | null>(null)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const pollCleanupRef = useRef<(() => void) | null>(null)

  function stopPolling() {
    pollCleanupRef.current?.()
    pollCleanupRef.current = null
  }

  function pollVerifier(requestId: string) {
    stopPolling()
    setWaitSeconds(0)

    const interval = setInterval(async () => {
      setWaitSeconds((s) => s + POLL_INTERVAL_MS / 1000)

      try {
        const res = await fetch(`/api/verifier-status?requestId=${requestId}`)
        const data = await res.json()

        if (data.status === 'yes' || data.status === 'no') {
          stopPolling()
          setVerifierAnswer(data.status)
          setVerifiedBy(data.verifiedBy ?? null)
          setStage(data.status === 'yes' ? 'verified' : 'declined')
          if (data.status === 'yes') {
            setTimeout(() => setStage('proceeding'), 1200)
          }
        }
      } catch {
        // Keep polling — a single failed check shouldn't kill the flow.
      }
    }, POLL_INTERVAL_MS)

    const timeout = setTimeout(() => {
      stopPolling()
      setStage('timed-out')
    }, VERIFIER_TIMEOUT_SECONDS * 1000)

    pollCleanupRef.current = () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }

  async function runAgent() {
    setStage('checking')
    setError(null)
    setResult(null)
    setVerifierAnswer(null)
    setVerifiedBy(null)

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Verification failed.')

      const parsed = data as VerifyResult
      setResult(parsed)

      if (parsed.needsHumanVerification) {
        setStage('awaiting-human')

        if (parsed.liveVerifier && parsed.requestId) {
          pollVerifier(parsed.requestId)
        } else {
          // Fallback simulation if Telegram isn't configured for this run.
          setTimeout(() => {
            setVerifierAnswer('yes')
            setStage('verified')
            setTimeout(() => setStage('proceeding'), 1800)
          }, 3800)
        }
      } else {
        setStage('proceeding')
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      setStage('idle')
    }
  }

  useEffect(() => {
    if (stage !== 'proceeding') return

    let cancelled = false

    fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: result?.requestId }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Payment failed.')
        if (!cancelled) {
          setPayment(data as PayResult)
          setStage('paid')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })

    return () => {
      cancelled = true
    }
  }, [stage, result?.requestId])

  function reset() {
    stopPolling()
    setStage('idle')
    setResult(null)
    setError(null)
    setVerifierAnswer(null)
    setVerifiedBy(null)
    setPayment(null)
    setWaitSeconds(0)
  }

  function keepWaiting() {
    if (result?.requestId) {
      setStage('awaiting-human')
      pollVerifier(result.requestId)
    }
  }

  function useFallbackAnswer() {
    stopPolling()
    setVerifierAnswer('yes')
    setStage('verified')
    setTimeout(() => setStage('proceeding'), 1200)
  }

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
                  it asks a real human first.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  A confidence check for autonomous agents — verified by a real person, paid
                  automatically on Solana.
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
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="py-4">
                <CardContent className="flex items-center gap-3">
                  <Mascot className="h-10 w-10 rounded-full" bounce />
                  <p className="text-sm text-muted-foreground">
                    Checking whether I actually know this, or need to ask someone…
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(stage === 'awaiting-human' || stage === 'verified' || stage === 'declined') && result && (
            <motion.div
              key="human"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mascot className="h-10 w-10 shrink-0 rounded-full" />
                    <p className="text-sm text-muted-foreground">{result.reasoning}</p>
                  </div>

                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                    <p className="mb-1 text-xs font-medium tracking-wide text-amber-500 uppercase">
                      Asking a real human to verify
                    </p>
                    <p className="text-sm font-medium">{result.verificationQuestion}</p>
                  </div>

                  {stage === 'awaiting-human' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                      </span>
                      Waiting for a verifier to respond… ({waitSeconds}s)
                    </div>
                  )}

                  {stage === 'verified' && verifierAnswer === 'yes' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 text-sm font-medium text-violet-500"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Verified by {verifiedBy ?? 'a real person'} — &quot;Yes, confirmed.&quot;
                    </motion.div>
                  )}

                  {stage === 'declined' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 text-sm font-medium text-red-400"
                    >
                      <XCircle className="h-4 w-4 shrink-0" />
                      {verifiedBy ?? 'A real person'} said no — agent will not spend any money.
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'timed-out' && result && (
            <motion.div key="timed-out" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-amber-500/30 bg-amber-500/5 py-4">
                <CardContent className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-amber-500">
                    <Clock className="h-4 w-4 shrink-0" />
                    No response yet after {VERIFIER_TIMEOUT_SECONDS}s
                  </p>
                  <p className="text-xs text-muted-foreground">
                    In production this would try another verifier automatically. For now:
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={keepWaiting} className="h-12 flex-1">
                      Keep waiting
                    </Button>
                    <Button variant="outline" size="sm" onClick={useFallbackAnswer} className="h-12 flex-1">
                      Use fallback answer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'proceeding' && (
            <motion.div key="paying" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Verified — releasing payment on Solana devnet…
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" />
                    Sending a real on-chain transaction
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {stage === 'paid' && payment && (
            <motion.div
              key="paid"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
            >
              <Card className="border-violet-500/40 bg-violet-500/5 py-4">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Payment sent — {payment.amountSol} SOL to the verifier
                  </div>
                  <p className="rounded-md bg-black/20 p-2 font-mono text-xs break-all text-muted-foreground">
                    {payment.signature}
                  </p>
                  <a
                    href={payment.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-violet-500 underline-offset-2 hover:underline"
                  >
                    View real transaction on Solana Explorer
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
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
