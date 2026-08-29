'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVerifierIdentity, type VerifierIdentity } from './verifier-identity'

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
 * wallet ownership and exchanges it for a session cookie. Works the same
 * whether `identity` came from a connected wallet-adapter wallet or a
 * Privy Google-login embedded wallet — the server only cares that the
 * signature verifies against the claimed public key, not who produced it.
 * Not every wallet supports signMessage; when it doesn't (or the user
 * declines), this throws and the caller is expected to swallow it per
 * spec: stay connected but unauthenticated, don't disconnect.
 */
export function useSignIn(identity: VerifierIdentity) {
  const queryClient = useQueryClient()
  // connect() resolves before React re-renders, so a mutate() fired from
  // that promise would close over stale identity state. Always read the
  // latest identity when the mutation actually runs.
  const identityRef = useRef(identity)
  useLayoutEffect(() => {
    identityRef.current = identity
  }, [identity])

  return useMutation({
    mutationFn: async () => {
      const { publicKey: wallet, signMessage } = identityRef.current
      if (!wallet) throw new Error('Connect a wallet first.')
      if (!signMessage) throw new Error('This wallet does not support message signing.')

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
 * Lives under both providers for the whole session so it doesn't unmount
 * the moment `connected` flips (the connect modal does). After a fresh
 * wallet connect OR a fresh Google login, request the Sign-In With Solana
 * signature — useVerifierIdentity already picks whichever is active.
 * Decline is fine — they stay connected but unauthenticated.
 */
export function SignInOnConnect() {
  const identity = useVerifierIdentity()
  const signIn = useSignIn(identity)
  const attemptedKey = useRef<string | null>(null)
  const signInRef = useRef(signIn)

  useLayoutEffect(() => {
    signInRef.current = signIn
  }, [signIn])

  useEffect(() => {
    if (!identity.connected) {
      attemptedKey.current = null
      return
    }
    // Wait until signMessage is actually available — `connected` can flip a
    // frame before it does, which used to throw WalletNotConnectedError and
    // look like the wallet never connected.
    if (!identity.publicKey || !identity.signMessage) return
    if (attemptedKey.current === identity.publicKey) return
    attemptedKey.current = identity.publicKey
    signInRef.current.mutate()
  }, [identity.connected, identity.publicKey, identity.signMessage])

  return null
}
