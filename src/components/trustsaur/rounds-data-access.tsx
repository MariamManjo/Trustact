'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface OpenRoundSummary {
  id: string
  question: string
  action: string
  proofRequirements: { photoRequired: boolean; locationRequired: boolean }
  feeLamports: number
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

export interface AnswerInput {
  roundId: string
  verifierWallet: string
  answer: 'yes' | 'no'
  note?: string
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ roundId, ...body }: AnswerInput) => {
      const res = await fetch(`/api/rounds/${roundId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit answer.')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds-open'] })
    },
  })
}
