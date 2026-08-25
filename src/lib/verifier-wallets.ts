import fs from 'fs'
import path from 'path'
import { PublicKey } from '@solana/web3.js'

const REGISTRY_PATH = path.join(process.cwd(), '.wallets', 'verifier-registry.json')

type Registry = Record<string, string> // telegramUserId -> Solana wallet address

function loadRegistry(): Registry {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function saveRegistry(registry: Registry) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true })
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2))
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export function registerVerifierWallet(telegramUserId: number, address: string): void {
  const registry = loadRegistry()
  registry[String(telegramUserId)] = address
  saveRegistry(registry)
}

export function getVerifierWallet(telegramUserId: number): string | undefined {
  return loadRegistry()[String(telegramUserId)]
}
