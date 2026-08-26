import { Keypair } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'

/**
 * Vercel's filesystem never gets .wallets/ (gitignored) and is read-only
 * outside /tmp, so production reads the key from PAYER_SECRET_KEY. Local
 * dev falls back to the file so scripts and `next dev` keep working
 * unchanged.
 */
export function loadPayerKeypair(): Keypair {
  const fromEnv = process.env.PAYER_SECRET_KEY
  if (fromEnv) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fromEnv)))
  }

  const filePath = path.join(process.cwd(), '.wallets', 'payer.json')
  const secret = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}
