'use client'

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTransactionToast } from '@/components/use-transaction-toast'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

/**
 * Single source of truth for SOL balance — the header pill and the Account
 * page both call this exact hook (same queryKey) so they share one cached
 * value and refetch together, instead of each polling independently and
 * drifting out of sync with each other. `address` may be undefined (e.g.
 * wallet not connected yet) — the query simply stays disabled until it is.
 */
export function useGetBalance({ address }: { address: PublicKey | undefined }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address: address?.toBase58() }],
    queryFn: () => connection.getBalance(address as PublicKey),
    enabled: Boolean(address),
    refetchInterval: 15_000,
  })
}

export function useGetSignatures({ address }: { address: PublicKey }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getSignaturesForAddress(address),
  })
}

export function useGetTokenAccounts({ address }: { address: PublicKey }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-token-accounts', { endpoint: connection.rpcEndpoint, address }],
    queryFn: async () => {
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ])
      return [...tokenAccounts.value, ...token2022Accounts.value]
    },
  })
}

export function useTransferSol({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  const transactionToast = useTransactionToast()
  const wallet = useWallet()
  const client = useQueryClient()

  return useMutation({
    mutationKey: ['transfer-sol', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (input: { destination: PublicKey; amount: number }) => {
      const { transaction, latestBlockhash } = await createTransaction({
        publicKey: address,
        destination: input.destination,
        amount: input.amount,
        connection,
      })

      const signature: TransactionSignature = await wallet.sendTransaction(transaction, connection)
      await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
      return signature
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
        }),
        client.invalidateQueries({
          queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
        }),
      ])
    },
    onError: (error) => {
      toast.error(`Transfer failed: ${getErrorMessage(error)}`)
    },
  })
}

/**
 * Backed by our own funded payer wallet (/api/faucet), not Solana's shared
 * public devnet faucet — that one is hit by every dApp on devnet and is
 * frequently rate-limited/exhausted as a result. Ours is rate-limited per
 * wallet (once a day) and per IP instead, so it stays available.
 */
export function useRequestAirdrop({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  const transactionToast = useTransactionToast()
  const client = useQueryClient()

  return useMutation({
    mutationKey: ['airdrop', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async () => {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address.toBase58() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Faucet request failed.')
      return data.signature as string
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
        }),
        client.invalidateQueries({
          queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
        }),
      ])
    },
    onError: (error) => {
      toast.error(`Airdrop failed: ${getErrorMessage(error)}`)
    },
  })
}

async function createTransaction({
  publicKey,
  destination,
  amount,
  connection,
}: {
  publicKey: PublicKey
  destination: PublicKey
  amount: number
  connection: Connection
}): Promise<{
  transaction: VersionedTransaction
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number }
}> {
  // Get the latest blockhash to use in our transaction
  const latestBlockhash = await connection.getLatestBlockhash()

  // Create instructions to send, in this case a simple transfer
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  ]

  // Create a new TransactionMessage with version and compile it to legacy
  const messageLegacy = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage()

  // Create a new VersionedTransaction which supports legacy and v0
  const transaction = new VersionedTransaction(messageLegacy)

  return {
    transaction,
    latestBlockhash,
  }
}
