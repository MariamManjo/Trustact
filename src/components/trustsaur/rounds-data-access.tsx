'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface OpenRoundSummary {
  id: string
  question: string
  action: string
  proofRequirements: { photoRequired: boolean; locationRequired: boolean }
  askerWallet?: string
  poolLamports: number
  answersCount: number
  closesAt: number
}

export function useOpenRounds() {
  return useQuery({
    queryKey: ['rounds-open'],
    queryFn: async (): Promise<OpenRoundSummary[]> => {
      const res = await fetch('/api/rounds/open')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load open rounds.')
      return data.rounds
    },
    refetchInterval: 3000,
  })
}

export interface RoundAnswerDetail {
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
  photoUrl?: string
  location?: { lat: number; lng: number; mapUrl: string }
}

/**
 * Full round detail including in-progress answers — only fetched for a
 * round the caller asked (see OpenRoundCard), never for rounds someone
 * else might still answer. Showing incoming answers to a not-yet-answered
 * verifier would let them anchor on others' answers instead of forming an
 * independent one, undermining the consensus mechanism; the asker can't
 * answer their own round anyway; so it's safe to show them.
 */
export function useOwnRoundAnswers(roundId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['round-detail', roundId],
    queryFn: async (): Promise<{ answers: RoundAnswerDetail[] }> => {
      const res = await fetch(`/api/rounds/${roundId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load answers.')
      return data
    },
    enabled,
    refetchInterval: 5000,
  })
}

export interface ReputationSummary {
  correct: number
  incorrect: number
  accuracy: number
  points: number
  asked: number
  answered: number
  earnedSol: number
  tier: { tier: string; name: string; minCorrect: number; avatarUnlocked: boolean }
}

export function useReputation(wallet: string | undefined) {
  return useQuery({
    queryKey: ['reputation', wallet],
    queryFn: async (): Promise<ReputationSummary> => {
      const res = await fetch(`/api/reputation?wallet=${wallet}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load reputation.')
      return data
    },
    enabled: Boolean(wallet),
  })
}

export interface HistoryAnswer {
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
  photoUrl?: string
  location?: { lat: number; lng: number; mapUrl: string }
  submittedAt: number
  judgment?: 'correct' | 'incorrect'
}

export interface HistoryPayment {
  signature: string
  explorerUrl: string
  totalAmountSol: number
  recipients: { wallet: string; amountSol: number }[]
}

export interface HistoryRound {
  id: string
  question: string
  action: string
  askerWallet: string
  status: 'judging' | 'settling' | 'expired' | 'resolved'
  answers: HistoryAnswer[]
  resolutionKind?: 'unanimous' | 'majority' | 'tie' | 'solo' | 'refund'
  payment?: HistoryPayment
  points?: Record<string, { amount: number }>
  createdAt: number
}

export interface HistoryResponse {
  rounds: HistoryRound[]
  nicknames: Record<string, string>
}

export function useRoundHistory(wallet: string | undefined) {
  return useQuery({
    queryKey: ['rounds-history', wallet],
    queryFn: async (): Promise<HistoryResponse> => {
      const res = await fetch(`/api/rounds/history?wallet=${wallet}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load history.')
      return data
    },
    enabled: Boolean(wallet),
    refetchInterval: 5000,
  })
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['rounds-activity'],
    queryFn: async (): Promise<HistoryResponse> => {
      const res = await fetch('/api/rounds/activity')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load activity.')
      return data
    },
    refetchInterval: 8000,
  })
}

export interface AnswerInput {
  roundId: string
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
  photo?: File
  location?: { lat: number; lng: number }
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ roundId, photo, location, ...rest }: AnswerInput) => {
      const form = new FormData()
      form.set('verifierWallet', rest.verifierWallet)
      form.set('answer', rest.answer)
      if (rest.note) form.set('note', rest.note)
      if (photo) form.set('photo', photo)
      if (location) {
        form.set('lat', String(location.lat))
        form.set('lng', String(location.lng))
      }

      const res = await fetch(`/api/rounds/${roundId}/answer`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit answer.')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds-open'] })
      queryClient.invalidateQueries({ queryKey: ['rounds-history'] })
    },
  })
}
