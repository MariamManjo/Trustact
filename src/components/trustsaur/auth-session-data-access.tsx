'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'

const SESSION_QUERY_KEY = ['auth-session']

export function useAuthSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async (): Promise<{ wallet: string | null }> => {
      const res = await fetch('/api/auth/session')
      return res.json()
    },
    staleTime: 30_000,
  })
}

/**
 * Sign-In With Solana (WALLET_UX_SPEC.md §2) — signs a message proving
 * wallet ownership and exchanges it for a session cookie. Not every wallet
 * adapter supports signMessage; when it doesn't (or the user declines),
 * this throws and the caller is expected to swallow it per spec: stay
 * connected but unauthenticated, don't disconnect.
 */
export function useSignIn() {
  const { publicKey, signMessage } = useWallet()
  const queryClient = useQueryClient()
  // connect() resolves before React re-renders, so a mutate() fired from
  // that promise would close over publicKey=null / a signMessage that still
  // thinks the wallet is disconnected (WalletNotConnectedError). Always
  // read the latest wallet state when the mutation actually runs.
  const publicKeyRef = useRef(publicKey)
  const signMessageRef = useRef(signMessage)
  useLayoutEffect(() => {
    publicKeyRef.current = publicKey
    signMessageRef.current = signMessage
  }, [publicKey, signMessage])

  return useMutation({
    mutationFn: async () => {
      const publicKey = publicKeyRef.current
      const signMessage = signMessageRef.current
      if (!publicKey) throw new Error('Connect a wallet first.')
      if (!signMessage) throw new Error('This wallet does not support message signing.')

      const wallet = publicKey.toBase58()
      const issuedAt = new Date().toISOString()
      const domain = window.location.hostname
      const message = `${domain} wants you to sign in with your Solana account:
${wallet}

This proves you control this wallet. It costs nothing and approves no transaction.

Issued at: ${issuedAt}`

      const signature = await signMessage(new TextEncoder().encode(message))

      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, issuedAt, signature: Array.from(signature) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sign-in failed.')
      return data.wallet as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    },
  })
}

/**
 * Lives under WalletProvider for the whole session so it doesn't unmount
 * the moment `connected` flips (the connect modal does). After a fresh
 * connect, request the Sign-In With Solana signature. Decline is fine —
 * they stay connected but unauthenticated.
 */
export function SignInOnConnect() {
  const { connected, publicKey, signMessage } = useWallet()
  const signIn = useSignIn()
  const attemptedKey = useRef<string | null>(null)
  const signInRef = useRef(signIn)

  useLayoutEffect(() => {
    signInRef.current = signIn
  }, [signIn])

  useEffect(() => {
    if (!connected) {
      attemptedKey.current = null
      return
    }
    // Wait until the adapter has published both — `connected` can flip a
    // frame before `signMessage` exists, which used to throw
    // WalletNotConnectedError and look like the wallet never connected.
    if (!publicKey || !signMessage) return
    const key = publicKey.toBase58()
    if (attemptedKey.current === key) return
    attemptedKey.current = key
    signInRef.current.mutate()
  }, [connected, publicKey, signMessage])

  return null
}
