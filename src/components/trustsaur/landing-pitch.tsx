import Image from 'next/image'
import { ArrowUpRight, CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HeroCharacter } from './hero-character'

/** A real, verifiable devnet payout from this build's own testing — not a mockup. */
const LIVE_PROOF_TX = 'AgKWuDm9KvsYsZ1fe6emdvoLKpXH27vsZUYgiLE4BcsWVENVKED8ZY6sU7WdCwiLrukwqd9Go9bYoaR4j4uBngf'
const LIVE_PROOF_URL = `https://explorer.solana.com/tx/${LIVE_PROOF_TX}?cluster=devnet`

function scrollToForm() {
  document.getElementById('agent-action-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold tracking-wider text-violet-400 uppercase">{children}</p>
}

const STATS = [
  { n: '$3.3M', l: 'moved by AI agents through Solana in a single week' },
  { n: '14%', l: 'of people trust AI to spend money on its own' },
  { n: '90%', l: 'of B2B purchases will run through agents by 2028' },
]

const LANDSCAPE = [
  {
    name: 'Free vote apps',
    detail: 'Anyone can answer. Nothing real is at stake, so nothing keeps an answer honest.',
    good: false,
  },
  {
    name: 'Prediction markets & games',
    detail: 'Real money is involved — but staked on a game, not on a fact an agent actually needs.',
    good: false,
  },
  {
    name: 'Trustact',
    detail: 'Real money, staked on a real fact, resolved by consensus — not a game, not a guess.',
    good: true,
  },
]

const HOW_IT_WORKS = [
  {
    title: 'Ask, starting at $1',
    body: 'A question opens with a small stake pool — free to post, the pool grows as people answer.',
  },
  {
    title: 'Answer correctly, split the pool',
    body: 'Everyone who gets it right splits the money the wrong answers staked — the faster you answer, the bigger your share.',
  },
  {
    title: 'Solana pays out in seconds',
    body: 'No invoice, no manual step — the moment it resolves, payment happens on-chain automatically.',
  },
]

export function LandingPitch() {
  return (
    <div className="space-y-16 pb-4">
      {/* Cover */}
      <section className="space-y-6 text-center">
        <p className="text-[1.9rem] leading-tight font-black tracking-tight text-balance text-white md:text-[2.4rem]">
          Before an AI agent spends your money,
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            a real person checks first.
          </span>
        </p>
        <p className="mx-auto max-w-lg text-sm font-medium text-muted-foreground md:text-base">
          A confidence check for AI agents — built solo, live on Solana today.
        </p>
        <HeroCharacter />
        <div className="flex justify-center">
          <Button
            onClick={scrollToForm}
            size="sm"
            className="h-11 w-[240px] max-w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400"
          >
            See it live <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Problem */}
      <section>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="text-xl font-bold text-white md:text-2xl">
          Agents can&apos;t check real facts — and a wrong guess costs real money.
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          Is a shop actually open. Is a road actually clear. An AI agent has no way to know what&apos;s true right
          now — and this matters more every month, as agents get real spending power in 2026.
        </p>
      </section>

      {/* Evidence */}
      <section>
        <Eyebrow>Why now</Eyebrow>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STATS.map((s) => (
            <Card key={s.n} className="py-4">
              <CardContent className="space-y-1 text-center">
                <p className="text-2xl font-black text-white md:text-3xl">{s.n}</p>
                <p className="text-xs text-muted-foreground">{s.l}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm font-medium text-white">
          Real money is already moving through agents. There&apos;s no trust behind it yet — that gap is exactly
          what Trustact fixes.
        </p>
      </section>

      {/* Live Proof */}
      <section>
        <Eyebrow>Live proof, not a mockup</Eyebrow>
        <Card className="border-violet-500/30 bg-violet-500/5 py-4">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />A real question, a real person, a real payment
            </div>
            <p className="text-sm text-muted-foreground">
              This transaction actually happened — four correct verifiers, paid automatically the moment their
              round resolved.
            </p>
            <a
              href={LIVE_PROOF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 underline-offset-2 hover:underline"
            >
              View the real transaction on Solana Explorer
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      </section>

      {/* Competitive landscape */}
      <section>
        <Eyebrow>What else is out there</Eyebrow>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LANDSCAPE.map((c) => (
            <Card key={c.name} className={`py-4 ${c.good ? 'border-violet-500/40 bg-violet-500/5' : ''}`}>
              <CardContent className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  {c.good ? (
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {c.name}
                </div>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <Eyebrow>How it works</Eyebrow>
        <div className="space-y-0">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="grid grid-cols-[32px_1fr] gap-3 border-t border-white/10 py-3 first:border-t-0">
              <span className="pt-0.5 font-mono text-sm text-violet-400">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product example */}
      <section>
        <Eyebrow>A real example someone asked us</Eyebrow>
        <Card className="py-4">
          <CardContent className="flex items-start gap-3">
            <Image
              src="/hero/happy.png"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                &ldquo;Is the disabled elevator working at the Tate museum right now?&rdquo;
              </p>
              <p className="text-xs text-muted-foreground">
                A real person checks, answers, and gets paid. That&apos;s Trustact, working right now — not a
                demo scenario.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Solo builder */}
      <section className="text-center">
        <p className="text-sm text-muted-foreground">
          Built alone, end to end — for <span className="font-medium text-white">Colosseum Eternal</span>.
        </p>
      </section>

      {/* Thank you / CTA */}
      <section className="space-y-4 text-center">
        <p className="text-lg font-bold text-white">No token. No NFTs.</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Just real people, answering real questions for real money, settled on Solana. It&apos;s live today.
        </p>
        <div className="flex justify-center">
          <Button
            onClick={scrollToForm}
            size="sm"
            className="h-11 w-[240px] max-w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400"
          >
            Try it now <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  )
}
