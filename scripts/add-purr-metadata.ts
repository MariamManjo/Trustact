import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import {
  createSignerFromKeypair,
  percentAmount,
  publicKey,
  signerIdentity,
} from '@metaplex-foundation/umi'
import fs from 'fs'
import path from 'path'

const RPC_URL = process.env.SOLANA_RPC_URL
if (!RPC_URL) {
  throw new Error('SOLANA_RPC_URL not set — check .env.local')
}

const PURR_MINT_ADDRESS = process.env.PURR_MINT_ADDRESS
if (!PURR_MINT_ADDRESS) {
  throw new Error('PURR_MINT_ADDRESS not set — check .env.local')
}

const PURR_METADATA_URI = process.env.PURR_METADATA_URI
if (!PURR_METADATA_URI) {
  throw new Error('PURR_METADATA_URI not set — check .env.local')
}

const umi = createUmi(RPC_URL).use(mplTokenMetadata())

// must be the SAME payer keypair — it is the mint authority
const payerPath = path.join(process.cwd(), '.wallets', 'payer.json')
const secretKeyBytes = Uint8Array.from(
  JSON.parse(fs.readFileSync(payerPath, 'utf8'))
)
const kp = umi.eddsa.createKeypairFromSecretKey(secretKeyBytes)
umi.use(signerIdentity(createSignerFromKeypair(umi, kp)))

async function main() {
  await createV1(umi, {
    mint: publicKey(PURR_MINT_ADDRESS!),
    authority: umi.identity,
    name: 'Purr Points',
    symbol: 'PURR',
    uri: PURR_METADATA_URI!,
    sellerFeeBasisPoints: percentAmount(0),
    // decimals is 0 on this mint — TokenStandard.Fungible expects decimals > 0
    // and errors on a zero-decimal mint. FungibleAsset is the documented
    // pairing for decimals 0; if this still errors, that's the trap to check first.
    tokenStandard: TokenStandard.FungibleAsset,
  }).sendAndConfirm(umi)

  console.log('Metadata attached to', PURR_MINT_ADDRESS)
}

main()
