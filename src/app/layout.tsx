import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppProviders } from '@/components/app-providers'
import { AppLayout } from '@/components/app-layout'
import React from 'react'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Trustact',
  description:
    'Before an AI agent spends your money, a real person checks first. Real questions, real people, real money, settled on Solana.',
}

const links: { label: string; path: string }[] = [
  // More links...
  { label: 'Home', path: '/' },
  { label: 'Verify', path: '/verify' },
  { label: 'Account', path: '/account' },
  { label: 'Basic Program', path: '/basic' },
]

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AppProviders>
          <AppLayout links={links}>{children}</AppLayout>
        </AppProviders>
      </body>
    </html>
  )
}
// Patch BigInt so we can log it using JSON.stringify without any errors
declare global {
  interface BigInt {
    toJSON(): string
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString()
}
