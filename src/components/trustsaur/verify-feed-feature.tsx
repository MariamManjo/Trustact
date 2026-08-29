'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { motion } from 'framer-motion'
import { Camera, CheckCircle2, Clock, MapPin, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ellipsify, formatTimeRemaining } from '@/lib/utils'
import { ConnectWalletModal } from './connect-wallet-modal'
import { EditProfileModal } from './edit-profile-modal'
import { CameraCapture } from './camera-capture'
import { LocationMap } from './location-map'
import { useVerifierIdentity } from './verifier-identity'
import { useProfile } from './profile-data-access'
import {
  useOpenRounds,
  useOwnRoundAnswers,
  useRecentActivity,
  useReputation,
  useRoundHistory,
  useSubmitAnswer,
  type HistoryRound,
  type OpenRoundSummary,
} from './rounds-data-access'

function OpenRoundCard({ round }: { round: OpenRoundSummary }) {
  const { connected, publicKey } = useVerifierIdentity()
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyAnswered, setAlreadyAnswered] = useState(false)
  const submitAnswer = useSubmitAnswer()

  const { photoRequired, locationRequired } = round.proofRequirements
  const missingPhoto = photoRequired && !photo
  const missingLocation = locationRequired && !location
  const canSubmit = Boolean(selected) && !missingPhoto && !missingLocation
  const isOwnQuestion = Boolean(round.askerWallet && publicKey && round.askerWallet === publicKey)

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
      (err) => {
        // No `timeout` here previously — if the fix stalls (a known iOS
        // Safari quirk), getCurrentPosition hangs forever with neither
        // callback firing, so "Getting location…" never resolves.
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location access is blocked. Enable it via the aA icon in the address bar → Website Settings → Location, then try again.'
            : err.code === err.TIMEOUT
              ? 'Location took too long. Check your signal and try again.'
              : 'Could not get your location. Try again.'
        setLocationError(message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function submit() {
    if (!publicKey || !selected || !canSubmit) return
    try {
      await submitAnswer.mutateAsync({
        roundId: round.id,
        verifierWallet: publicKey,
        answer: selected,
        note: note.trim() || undefined,
        photo: photo ?? undefined,
        location: location ?? undefined,
      })
      setSubmitted(true)
    } catch (err) {
      // Permanent for this wallet+round — retrying just repeats the same
      // 400 forever, so stop showing an active form instead of leaving the
      // error message next to a Submit button that can never succeed.
      if (err instanceof Error && err.message.toLowerCase().includes('already answered')) {
        setAlreadyAnswered(true)
      }
      // Otherwise submitAnswer.error already surfaces the message below.
    }
  }

  const poolSol = round.poolLamports / LAMPORTS_PER_SOL

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
        <p className="text-xs text-muted-foreground">
          {poolSol} SOL pool. Answer for free, correct and fastest answers split it, no self-judging.
          {' · '}
          {formatTimeRemaining(round.closesAt)}
        </p>

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

        {submitted || alreadyAnswered ? (
          <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {alreadyAnswered
              ? "You've already answered this question."
              : 'Answered. Resolves by consensus, no one judges their own round.'}
          </div>
        ) : !connected ? (
          <ConnectPrompt />
        ) : isOwnQuestion ? (
          <OwnQuestionAnswers roundId={round.id} answersCount={round.answersCount} />
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setSelected('yes')}
                disabled={submitAnswer.isPending}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  selected === 'yes' ? 'bg-violet-500 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Yes
              </button>
              <button
                onClick={() => setSelected('no')}
                disabled={submitAnswer.isPending}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  selected === 'no' ? 'bg-red-500/80 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> No
              </button>
            </div>

            {photoRequired && <CameraCapture onCapture={setPhoto} />}

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
                {location && <LocationMap lat={location.lat} lng={location.lng} />}
              </div>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitAnswer.isPending}
              placeholder="Optional note for the asker"
              className="min-h-16 w-full resize-none rounded-md border border-white/10 bg-black/20 p-2 text-xs placeholder:text-muted-foreground/60 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
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
              {submitAnswer.isPending ? 'Submitting answer…' : 'Submit answer'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Live view of who's answered your own question so far — never shown to anyone who could still answer it themselves. */
function OwnQuestionAnswers({ roundId, answersCount }: { roundId: string; answersCount: number }) {
  const { data, isLoading } = useOwnRoundAnswers(roundId, answersCount > 0)

  if (answersCount === 0) {
    return <p className="text-xs text-muted-foreground">You asked this one, so you can&apos;t answer it yourself. Nobody has answered yet.</p>
  }
  if (isLoading || !data) {
    return <div className="h-10 animate-pulse rounded-md bg-white/5" />
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {data.answers.length} answer{data.answers.length === 1 ? '' : 's'} so far
      </p>
      {data.answers.map((a) => (
        <div key={a.verifierWallet} className="space-y-2 rounded-md bg-black/20 p-2 text-xs">
          <div className="flex items-start gap-2">
            {a.answer === 'yes' ? (
              <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-violet-400" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5 shrink-0 text-red-400" />
            )}
            <div className="flex-1 space-y-0.5">
              <div className="font-medium">
                {ellipsify(a.verifierWallet)} answered {a.answer}
              </div>
              {a.note && <div className="text-muted-foreground">{a.note}</div>}
            </div>
          </div>

          {a.photoUrl && (
            <div className="relative h-40 w-full overflow-hidden rounded-md">
              <Image src={a.photoUrl} alt={`Photo proof from ${ellipsify(a.verifierWallet)}`} fill className="object-cover" />
            </div>
          )}

          {a.location && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" /> Location at the time of the answer
              </p>
              <LocationMap lat={a.location.lat} lng={a.location.lng} className="h-40" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function historyOutcome(round: HistoryRound): { label: string; tone: 'violet' | 'amber' | 'muted' } {
  if (round.status === 'judging' || round.status === 'settling') {
    return { label: 'Settling by consensus…', tone: 'amber' }
  }
  if (round.status === 'expired') {
    return { label: 'Nobody answered — refunding deposit…', tone: 'amber' }
  }
  if (round.resolutionKind === 'refund') {
    return { label: 'Nobody answered in time — deposit refunded', tone: 'muted' }
  }
  if (!round.payment) {
    return { label: 'Resolved — nothing to pay out', tone: 'muted' }
  }
  if (round.resolutionKind === 'majority') {
    return { label: `Majority resolved · ${round.payment.totalAmountSol} SOL split`, tone: 'violet' }
  }
  const kind = round.resolutionKind === 'solo' ? 'Solo answer' : round.resolutionKind === 'tie' ? 'No clear majority' : 'Unanimous'
  return { label: `${kind} · ${round.payment.totalAmountSol} SOL split, no platform cut`, tone: 'violet' }
}

function HistoryRoundCard({
  round,
  viewerWallet,
  nicknames = {},
}: {
  round: HistoryRound
  viewerWallet?: string
  nicknames?: Record<string, string>
}) {
  const outcome = historyOutcome(round)
  const isAsker = round.askerWallet === viewerWallet
  const isAnswerer = round.answers.some((a) => a.verifierWallet === viewerWallet)
  const displayName = (wallet: string) => nicknames[wallet] ?? ellipsify(wallet)
  const badgeLabel = isAsker ? 'You asked' : isAnswerer ? 'You answered' : `Asked by ${displayName(round.askerWallet)}`
  const toneClass =
    outcome.tone === 'violet'
      ? 'text-violet-500'
      : outcome.tone === 'amber'
        ? 'text-amber-500'
        : 'text-muted-foreground'

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium">{round.question}</p>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {badgeLabel}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 text-xs font-medium ${toneClass}`}>
          {outcome.tone === 'violet' ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : outcome.tone === 'amber' ? (
            <Clock className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {outcome.label}
        </div>

        {round.answers.length > 0 && (
          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              {round.answers.length} answer{round.answers.length === 1 ? '' : 's'}
            </p>
            {round.answers.map((a) => (
              <div key={a.verifierWallet} className="space-y-2 rounded-md bg-black/20 p-2 text-xs">
                <div className="flex items-start gap-2">
                  {a.answer === 'yes' ? (
                    <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  ) : (
                    <ThumbsDown className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <div className="font-medium">
                      {a.verifierWallet === viewerWallet ? 'You' : displayName(a.verifierWallet)}
                      {' answered '}
                      {a.answer}
                      {a.judgment && (
                        <span className={a.judgment === 'correct' ? 'text-violet-400' : 'text-red-400'}>
                          {' · '}
                          {a.judgment}
                        </span>
                      )}
                    </div>
                    {a.note && <div className="text-muted-foreground">{a.note}</div>}
                  </div>
                </div>

                {a.photoUrl && (
                  <div className="relative h-40 w-full overflow-hidden rounded-md">
                    <Image
                      src={a.photoUrl}
                      alt={`Photo proof from ${displayName(a.verifierWallet)}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {a.location && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> Location at the time of the answer
                    </p>
                    <LocationMap lat={a.location.lat} lng={a.location.lng} className="h-40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {round.payment && (
          <a
            href={round.payment.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-violet-500 underline-offset-2 hover:underline"
          >
            View transaction on Solana Explorer
          </a>
        )}
      </CardContent>
    </Card>
  )
}

function HistorySection() {
  const { publicKey: wallet } = useVerifierIdentity()
  const { data, isLoading } = useRoundHistory(wallet ?? undefined)

  if (!wallet) return null
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
      </div>
    )
  }
  if (!data || data.rounds.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-violet-500">Your history</h2>
      <div className="space-y-3">
        {data.rounds.map((round) => (
          <HistoryRoundCard key={round.id} round={round} viewerWallet={wallet} nicknames={data.nicknames} />
        ))}
      </div>
    </div>
  )
}

function RecentActivitySection() {
  const { publicKey } = useVerifierIdentity()
  const { data, isLoading } = useRecentActivity()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
      </div>
    )
  }
  if (!data || data.rounds.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-violet-500">Recent activity</h2>
      <p className="text-xs text-muted-foreground">Every resolved question across Trustact, asked and answered by real people.</p>
      <div className="space-y-3">
        {data.rounds.map((round) => (
          <HistoryRoundCard
            key={round.id}
            round={round}
            viewerWallet={publicKey ?? undefined}
            nicknames={data.nicknames}
          />
        ))}
      </div>
    </div>
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

function ProfileCard() {
  const { publicKey } = useVerifierIdentity()
  const { data, isLoading } = useReputation(publicKey ?? undefined)
  const { data: profile } = useProfile(publicKey ?? undefined)
  const [editOpen, setEditOpen] = useState(false)

  if (!publicKey) return null
  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/5" />
  }
  if (!data) return null

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{profile?.nickname || ellipsify(publicKey)}</span>
        <span className="rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">
          {data.tier.name}
        </span>
        <button
          onClick={() => setEditOpen(true)}
          className="text-xs text-violet-400 underline-offset-2 hover:underline"
        >
          {profile?.nickname ? 'Edit' : 'Set a nickname'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div>
          <div className="text-lg font-semibold">{data.asked}</div>
          <div className="text-[11px] text-muted-foreground">asked</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{data.answered}</div>
          <div className="text-[11px] text-muted-foreground">answered</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{data.earnedSol.toFixed(3)}</div>
          <div className="text-[11px] text-muted-foreground">SOL earned</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{Math.round(data.accuracy * 100)}%</div>
          <div className="text-[11px] text-muted-foreground">
            accuracy · {data.points} pts
          </div>
        </div>
      </div>

      <EditProfileModal wallet={publicKey} open={editOpen} onOpenChange={setEditOpen} />
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
            Real questions with a real pool. Answer for free, resolved by consensus and paid in seconds.
          </p>
        </div>
        <ProfileCard />
      </div>

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
            No open questions right now. Check back soon.
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

      <HistorySection />
      <RecentActivitySection />
    </div>
  )
}
