'use client'

import { useState } from 'react'
import { ArrowUpRight, MapPin, Star, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface JudgeAnswer {
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
  submittedAt: number
  photoUrl?: string
  location?: { lat: number; lng: number; mapUrl: string }
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
}

function timeAgo(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.round(seconds / 60)}m ago`
}

export function RoundJudgeCards({
  answers,
  onSubmit,
  submitting,
}: {
  answers: JudgeAnswer[]
  onSubmit: (judgments: Record<string, 'correct' | 'incorrect'>, bonusWinnerWallet?: string) => void
  submitting: boolean
}) {
  const [judgments, setJudgments] = useState<Record<string, 'correct' | 'incorrect'>>({})
  const [bonusWinner, setBonusWinner] = useState<string | undefined>(undefined)

  const allJudged = answers.every((a) => judgments[a.verifierWallet])

  function setJudgment(wallet: string, value: 'correct' | 'incorrect') {
    setJudgments((prev) => ({ ...prev, [wallet]: value }))
    if (value === 'incorrect' && bonusWinner === wallet) setBonusWinner(undefined)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {answers.map((a) => {
          const judgment = judgments[a.verifierWallet]
          return (
            <div
              key={a.verifierWallet}
              className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{shortWallet(a.verifierWallet)}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(a.submittedAt)}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm font-medium">
                {a.answer === 'yes' ? (
                  <span className="flex items-center gap-1 text-violet-400">
                    <ThumbsUp className="h-3.5 w-3.5" /> Yes
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400">
                    <ThumbsDown className="h-3.5 w-3.5" /> No
                  </span>
                )}
              </div>

              {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}

              {a.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Blob store hostname is dynamic per-deployment
                <img src={a.photoUrl} alt="Verifier proof" className="h-32 w-full rounded-md object-cover" />
              )}

              {a.location && (
                <a
                  href={a.location.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 underline-offset-2 hover:underline"
                >
                  <MapPin className="h-3 w-3" /> View location
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setJudgment(a.verifierWallet, 'correct')}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    judgment === 'correct'
                      ? 'bg-violet-500 text-white'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  Correct
                </button>
                <button
                  onClick={() => setJudgment(a.verifierWallet, 'incorrect')}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    judgment === 'incorrect'
                      ? 'bg-red-500/80 text-white'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  Incorrect
                </button>
                <button
                  onClick={() => setBonusWinner(bonusWinner === a.verifierWallet ? undefined : a.verifierWallet)}
                  disabled={judgment !== 'correct'}
                  title="Pick as bonus winner"
                  className={`rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    bonusWinner === a.verifierWallet
                      ? 'bg-amber-500 text-white'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <Star className="h-3.5 w-3.5" fill={bonusWinner === a.verifierWallet ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Button
        size="sm"
        disabled={!allJudged || submitting}
        onClick={() => onSubmit(judgments, bonusWinner)}
        className="h-11 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50"
      >
        {submitting ? 'Paying out…' : allJudged ? 'Judge & pay out' : 'Mark every answer correct or incorrect'}
      </Button>
    </div>
  )
}
