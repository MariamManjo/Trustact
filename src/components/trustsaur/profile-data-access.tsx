'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useProfile(wallet: string | undefined) {
  return useQuery({
    queryKey: ['profile', wallet],
    queryFn: async (): Promise<{ nickname: string | null }> => {
      const res = await fetch(`/api/profile?wallet=${wallet}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load profile.')
      return data
    },
    enabled: Boolean(wallet),
  })
}

export function useUpdateNickname() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (nickname: string) => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save nickname.')
      return data as { wallet: string; nickname: string | null }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', data.wallet], { nickname: data.nickname })
    },
  })
}
