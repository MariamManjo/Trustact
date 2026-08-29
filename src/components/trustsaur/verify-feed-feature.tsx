'use client'

import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { motion } from 'framer-motion'
import { Camera, CheckCircle2, MapPin, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConnectWalletModal } from './connect-wallet-modal'
import { CameraCapture } from './camera-capture'
import { LocationMap } from './location-map'
import {
  useOpenRounds,
  useReputation,
  useSubmitAnswer,
  useTreasuryAddress,
  type OpenRoundSummary,
} from './rounds-data-access'

function OpenRoundCard({ round }: { round: OpenRoundSummary }) {
  const { connected, publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { data: treasuryAddress } = useTreasuryAddress()
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [staking, setStaking] = useState(false)
  const [stakePhase, setStakePhase] = useState<'signing' | 'confirming' | 'submitting' | null>(null)
  const [stakeError, setStakeError] = useState<string | null>(null)
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
      (err) => {
        // No `timeout` here previously — if the fix stalls (a known iOS
        // Safari quirk), getCurrentPosition hangs forever with neither
        // callback firing, so "Getting location…" never resolves.
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location access is blocked. Enable it via the aA icon in the address bar → Website Settings → Location, then try again.'
            : err.code === err.TIMEOUT
              ? 'Location took too long — check your signal and try again.'
              : 'Could not get your location — try again.'
        setLocationError(message)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function submit() {
    if (!publicKey || !selected || !canSubmit || !treasuryAddress) return
    setStakeError(null)
    setStaking(true)
    setStakePhase('signing')
    try {
      // Stake first, on-chain — the answer only counts once this is
      // confirmed, so guessing costs real money instead of being free.
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(treasuryAddress),
          lamports: round.stakeLamports,
        })
      )
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signature = await sendTransaction(transaction, connection)
      setStakePhase('confirming')
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')

      setStakePhase('submitting')
      await submitAnswer.mutateAsync({
        roundId: round.id,
        verifierWallet: publicKey.toBase58(),
        answer: selected,
        stakeSignature: signature,
        note: note.trim() || undefined,
        photo: photo ?? undefined,
        location: location ?? undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setStakeError(err instanceof Error ? err.message : 'Stake transaction failed — try again.')
    } finally {
      setStaking(false)
      setStakePhase(null)
    }
  }

  const stakeSol = round.stakeLamports / LAMPORTS_PER_SOL

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
          Stake {stakeSol} SOL on your answer — wrong answers fund correct ones, no self-judging
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

        {submitted ? (
          <div className="flex items-center gap-2 text-sm font-medium text-violet-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Staked and answered — resolves by consensus, no one judges their own round.
          </div>
        ) : !connected ? (
          <ConnectPrompt />
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setSelected('yes')}
                disabled={staking}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  selected === 'yes' ? 'bg-violet-500 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Yes
              </button>
              <button
                onClick={() => setSelected('no')}
                disabled={staking}
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
              disabled={staking}
              placeholder="Optional note for the asker"
              className="min-h-16 w-full resize-none rounded-md border border-white/10 bg-black/20 p-2 text-xs placeholder:text-muted-foreground/60 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
            />
            {(stakeError || submitAnswer.error) && (
              <p className="text-xs text-red-400">
                {stakeError ?? (submitAnswer.error as Error).message}
              </p>
            )}
            <Button
              size="sm"
              disabled={!canSubmit || !treasuryAddress || staking || submitAnswer.isPending}
              onClick={submit}
              className="h-9 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-xs font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50"
            >
              {stakePhase === 'signing'
                ? 'Confirm in your wallet…'
                : stakePhase === 'confirming'
                  ? 'Confirming stake…'
                  : stakePhase === 'submitting' || submitAnswer.isPending
                    ? 'Submitting answer…'
                    : !treasuryAddress
                      ? 'Loading…'
                      : `Stake ${stakeSol} SOL & answer`}
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
  const { data, isLoading } = useReputation(publicKey?.toBase58())

  if (!publicKey) return null
  if (isLoading) {
    return <div className="h-9 animate-pulse rounded-lg border border-white/10 bg-white/5" />
  }
  if (!data) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
      <span className="rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 px-2 py-0.5 font-medium text-violet-300">
        {data.tier.name}
      </span>
      <span className="text-muted-foreground">
        {data.correct} correct · {data.incorrect} incorrect · {Math.round(data.accuracy * 100)}% accuracy
      </span>
      <span className="text-muted-foreground">{data.points} pts</span>
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
            Real questions, free to post. Stake on your answer — resolved by consensus, paid in seconds.
          </p>
        </div>
        <ReputationBadge />
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
