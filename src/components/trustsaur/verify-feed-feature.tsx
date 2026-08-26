'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CheckCircle2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConnectWalletModal } from './connect-wallet-modal'
import { useOpenRounds, useSubmitAnswer, type OpenRoundSummary } from './rounds-data-access'

function OpenRoundCard({ round }: { round: OpenRoundSummary }) {
  const { connected, publicKey } = useWallet()
  const [selected, setSelected] = useState<'yes' | 'no' | null>(null)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const submitAnswer = useSubmitAnswer()

  async function submit() {
    if (!publicKey || !selected) return
    await submitAnswer.mutateAsync({
      roundId: round.id,
      verifierWallet: publicKey.toBase58(),
      answer: selected,
      note: note.trim() || undefined,
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
              disabled={!selected || submitAnswer.isPending}
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

export function VerifyFeedFeature() {
  const { data: rounds, isLoading } = useOpenRounds()

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-violet-500">Verify</h1>
        <p className="text-sm text-muted-foreground">
          Real questions from AI agents, waiting on real people. Answer one, get judged, get paid.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading open questions…</p>}

      {!isLoading && (!rounds || rounds.length === 0) && (
        <Card className="py-4">
          <CardContent className="text-sm text-muted-foreground">
            No open questions right now — check back soon.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rounds?.map((round) => (
          <OpenRoundCard key={round.id} round={round} />
        ))}
      </div>
    </div>
  )
}
