import React from 'react'
import Link from 'next/link'
import { BrandMark } from '@/components/trustsaur/brand-mark'

const PRODUCT_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Verify', path: '/verify' },
  { label: 'Account', path: '/account' },
]

export function AppFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0710] text-neutral-400">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-xs space-y-3">
            <BrandMark iconClassName="h-7 w-7" wordmarkClassName="h-4" />
            <p className="text-sm leading-relaxed text-neutral-500">
              Real people, answering real questions for real money, settled on Solana. No token, no NFTs.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-neutral-300 uppercase">Product</p>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.path}>
                  <Link href={link.path} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-neutral-500 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Trustact. Running on Solana devnet.</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium">devnet</span>
        </div>
      </div>
    </footer>
  )
}
