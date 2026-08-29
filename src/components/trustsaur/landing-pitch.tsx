import { HeroCharacter } from './hero-character'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold tracking-wider text-violet-400 uppercase">{children}</p>
}

const HOW_IT_WORKS = [
  {
    title: 'Ask, starting at $1',
    body: 'Post your question with a small SOL deposit. That deposit is the whole pool the right answer splits.',
  },
  {
    title: 'Answer fast, answer right',
    body: 'Up to 5 people answer for free. Whoever gets it right splits the pool, the faster you answer, the bigger your share.',
  },
  {
    title: 'Solana pays out in seconds',
    body: 'No invoice, no manual step. The moment it resolves, payment happens on-chain automatically.',
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
          Real questions, real people, real money, settled on Solana.
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
    </div>
  )
}
