'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { ClusterUiSelect } from './cluster/cluster-ui'
import { HeaderWalletPill } from '@/components/trustsaur/header-wallet-pill'
import { BrandMark } from '@/components/trustsaur/brand-mark'

export function AppHeader({ links = [] }: { links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0710]/80 px-4 py-2.5 text-neutral-300 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link className="transition-opacity hover:opacity-80" href="/">
            <BrandMark iconClassName="h-8 w-8" wordmarkClassName="text-lg" />
          </Link>
          <div className="hidden md:flex items-center">
            <ul className="flex flex-nowrap items-center gap-1">
              {links.map(({ label, path }) => (
                <li key={path}>
                  <Link
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive(path) ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                    href={path}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-neutral-300 hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setShowMenu(!showMenu)}
        >
          {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        <div className="hidden items-center gap-2 md:flex">
          <HeaderWalletPill />
          <ClusterUiSelect />
        </div>

        {showMenu && (
          <div className="fixed inset-x-0 top-[57px] bottom-0 z-40 bg-[#0a0710]/95 backdrop-blur-sm md:hidden">
            <div className="flex flex-col gap-4 border-t border-white/10 p-4">
              <ul className="flex flex-col gap-1">
                {links.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`block rounded-lg px-3 py-2.5 text-lg font-medium ${
                        isActive(path) ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                      href={path}
                      onClick={() => setShowMenu(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3">
                <HeaderWalletPill />
                <ClusterUiSelect />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
