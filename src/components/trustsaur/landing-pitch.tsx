import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HeroCharacter } from './hero-character'

function scrollToForm() {
  document.getElementById('agent-action-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold tracking-wider text-violet-400 uppercase">{children}</p>
}

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
    <div className="space-y-12 pb-4">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <p className="text-[1.9rem] leading-tight font-black tracking-tight text-balance text-white md:text-[2.4rem]">
          Before an AI agent spends your money,
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            a real person checks first.
          </span>
        </p>
        <p className="mx-auto max-w-lg text-sm font-medium text-muted-foreground md:text-base">
          Real questions, real people, real money — settled on Solana.
        </p>
        <HeroCharacter />
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

      {/* Real example */}
      <section>
        <Eyebrow>A real example</Eyebrow>
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
                A real person checks, answers, and gets paid automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Action */}
      <div className="flex justify-center">
        <Button
          onClick={scrollToForm}
          size="sm"
          className="h-11 w-[240px] max-w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400"
        >
          Try it now <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
