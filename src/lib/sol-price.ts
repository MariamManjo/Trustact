import { LAMPORTS_PER_SOL } from '@solana/web3.js'

// Devnet SOL has no real market value, but the asker-set fee is meant to
// approximate a real-world minimum ("at least $1"), so we still price it
// against mainnet SOL/USD. A brief in-memory cache avoids hitting the rate
// limit on every round creation; a documented fallback keeps round creation
// working even if the price API is unreachable.
const CACHE_TTL_MS = 60_000
const FALLBACK_SOL_USD = 150 // approximate — used only if the price API fails

let cached: { price: number; fetchedAt: number } | null = null

export async function getSolUsdPrice(): Promise<number> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.price
  }

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`)

    const data = await res.json()
    const price = data?.solana?.usd
    if (typeof price !== 'number' || price <= 0) throw new Error('Unexpected CoinGecko response shape')

    cached = { price, fetchedAt: Date.now() }
    return price
  } catch (err) {
    console.error('sol-price: falling back to approximate SOL/USD price:', err)
    return FALLBACK_SOL_USD
  }
}

export async function usdToLamports(usd: number): Promise<number> {
  const solUsd = await getSolUsdPrice()
  const sol = usd / solUsd
  return Math.round(sol * LAMPORTS_PER_SOL)
}
