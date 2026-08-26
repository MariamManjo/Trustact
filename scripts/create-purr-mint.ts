import { Connection, Keypair } from '@solana/web3.js'
import { createMint } from '@solana/spl-token'
import fs from 'fs'
import path from 'path'

const RPC_URL = process.env.SOLANA_RPC_URL
if (!RPC_URL) {
  throw new Error('SOLANA_RPC_URL not set — check .env.local')
}

const connection = new Connection(RPC_URL, 'confirmed')

const payerPath = path.join(process.cwd(), '.wallets', 'payer.json')
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(payerPath, 'utf8')))
)

async function main() {
  const mint = await createMint(
    connection,
    payer, // pays for the tx
    payer.publicKey, // mint authority
    null, // freeze authority — none
    0 // decimals
  )

  console.log('PURR_MINT_ADDRESS=', mint.toBase58())
}

main()
