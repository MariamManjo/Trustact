'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface OpenRoundSummary {
  id: string
  question: string
  action: string
  proofRequirements: { photoRequired: boolean; locationRequired: boolean }
  stakeLamports: number
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

/** The address verifiers stake into — rarely changes, safe to cache for the session. */
export function useTreasuryAddress() {
  return useQuery({
    queryKey: ['treasury-address'],
    queryFn: async (): Promise<string> => {
      const res = await fetch('/api/treasury')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load treasury address.')
      return data.address
    },
    staleTime: Infinity,
  })
}

export interface ReputationSummary {
  correct: number
  incorrect: number
  accuracy: number
  points: number
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

export interface AnswerInput {
  roundId: string
  verifierWallet: string
  answer: 'yes' | 'no'
  /** On-chain signature of the verifier's stake transfer — required, verified server-side. */
  stakeSignature: string
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
      form.set('stakeSignature', rest.stakeSignature)
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
    },
  })
}
