'use client'

import { useState, type FormEvent } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { motion } from 'framer-motion'
import { Bell, Camera, CheckCircle2, MapPin, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConnectWalletModal } from './connect-wallet-modal'
import { useOpenRounds, useReputation, useSubmitAnswer, type OpenRoundSummary } from './rounds-data-access'

function NotifySignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch('/api/notify-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (status === 'done') {
    return (
      <Card className="py-4">
        <CardContent className="flex items-center gap-2 text-sm font-medium text-violet-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          You&apos;re in — we&apos;ll email {email} when a new question opens.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-4">
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="notify-email" className="sr-only">
            Email address
          </label>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3">
            <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              id="notify-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={status === 'submitting'}
            className="h-9 shrink-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-xs font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50"
          >
            {status === 'submitting' ? 'Signing up…' : 'Notify me about new questions'}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  )
}

function OpenRoundCard({ round }: { round: OpenRoundSummary }) {
  const { connected, publicKey } = useWallet()
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submitAnswer = useSubmitAnswer()

  const { photoRequired, locationRequired } = round.proofRequirements
  const missingPhoto = photoRequired && !photo
  const missingLocation = locationRequired && !location
  const canSubmit = Boolean(selected) && !missingPhoto && !missingLocation

  function shareLocation() {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not available in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocationError('Could not get your location — check permissions and try again.')
        setLocating(false)
      }
    )
  }

  async function submit() {
    if (!publicKey || !selected || !canSubmit) return
    await submitAnswer.mutateAsync({
      roundId: round.id,
      verifierWallet: publicKey.toBase58(),
      answer: selected,
      note: note.trim() || undefined,
      photo: photo ?? undefined,
      location: location ?? undefined,
    })
    setSubmitted(true)
  }

  const feeSol = round.feeLamports / LAMPORTS_PER_SOL

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium">{round.question}</p>
          <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
            {round.answersCount}/5
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{round.action}</p>
        <p className="text-xs text-muted-foreground">Fee pool: {feeSol} SOL, split among correct verifiers</p>

        {(photoRequired || locationRequired) && (
          <div className="flex gap-1.5">
            {photoRequired && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                <Camera className="h-3 w-3" /> Photo required
              </span>
            )}
            {locationRequired && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                <MapPin className="h-3 w-3" /> Location required
              </span>
            )}
          </div>
        )}

        {submitted ? (
          <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Answer submitted — the asker will judge it shortly.
          </div>
        ) : !connected ? (
          <ConnectPrompt />
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setSelected('yes')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
                  selected === 'yes' ? 'bg-violet-500 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Yes
              </button>
              <button
                onClick={() => setSelected('no')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
                  selected === 'no' ? 'bg-red-500/80 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> No
              </button>
            </div>

            {photoRequired && (
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-foreground"
                />
                {photo && <p className="text-xs text-violet-400">{photo.name} attached</p>}
              </div>
            )}

            {locationRequired && (
              <div className="space-y-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locating}
                  onClick={shareLocation}
                  className="h-8 w-full text-xs"
                >
                  <MapPin className="h-3 w-3" />
                  {location ? 'Location shared' : locating ? 'Getting location…' : 'Share my location'}
                </Button>
                {locationError && <p className="text-xs text-red-400">{locationError}</p>}
              </div>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for the asker"
              className="min-h-16 w-full resize-none rounded-md border border-white/10 bg-black/20 p-2 text-xs placeholder:text-muted-foreground/60 focus:border-violet-500/40 focus:outline-none"
            />
            {submitAnswer.error && (
              <p className="text-xs text-red-400">{(submitAnswer.error as Error).message}</p>
            )}
            <Button
              size="sm"
              disabled={!canSubmit || submitAnswer.isPending}
              onClick={submit}
              className="h-9 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-xs font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50"
            >
              {submitAnswer.isPending ? 'Submitting…' : 'Submit answer'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ConnectPrompt() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        variant="outline"
        className="h-9 w-full text-xs font-medium"
      >
        Connect your wallet to answer
      </Button>
      <ConnectWalletModal open={open} onOpenChange={setOpen} />
    </>
  )
}

function ReputationBadge() {
  const { publicKey } = useWallet()
  const { data } = useReputation(publicKey?.toBase58())

  if (!publicKey || !data) return null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
      <span className="font-medium text-violet-400">{data.tier.name} verifier</span>
      <span className="text-muted-foreground">
        {data.correct} correct · {data.incorrect} incorrect · {Math.round(data.accuracy * 100)}% accuracy
      </span>
      <span className="text-muted-foreground">{data.purrBalance} $PURR</span>
    </div>
  )
}

export function VerifyFeedFeature() {
  const { data: rounds, isLoading } = useOpenRounds()

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <div className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-violet-500">Verify</h1>
          <p className="text-sm text-muted-foreground">
            Real questions from AI agents, waiting on real people. Answer one, get judged, get paid.
          </p>
        </div>
        <ReputationBadge />
      </div>

      <NotifySignup />

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-white/10 bg-white/5" />
          ))}
        </div>
      )}

      {!isLoading && (!rounds || rounds.length === 0) && (
        <Card className="py-4">
          <CardContent className="text-sm text-muted-foreground">
            No open questions right now — check back soon.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rounds?.map((round, i) => (
          <motion.div
            key={round.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
          >
            <OpenRoundCard round={round} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
