'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

interface Step {
  eyebrow: string
  title: string
  body: string
  /** crop of the source photo — gives each step a different "pose" without new art */
  focus: 'face' | 'upper' | 'full'
}

const STEPS: Step[] = [
  {
    eyebrow: '1. The problem',
    title: 'Your AI agent is about to spend your money.',
    body: 'Booking a table, buying an item, holding a reservation — autonomous agents act on what they know, not on what’s actually true right now.',
    focus: 'face',
  },
  {
    eyebrow: '2. The fix',
    title: 'It checks with a real human first.',
    body: 'Before committing money, the agent asks one real-time question a real person can answer in seconds — something no model can know from training data.',
    focus: 'upper',
  },
  {
    eyebrow: '3. The payment',
    title: 'Verified, then paid automatically on Solana.',
    body: 'Once a human confirms, payment releases on its own — a real on-chain transaction, not a manual step.',
    focus: 'full',
  },
]

const FOCUS_STYLES: Record<Step['focus'], { objectPosition: string; scale: number }> = {
  face: { objectPosition: '50% 20%', scale: 1.7 },
  upper: { objectPosition: '50% 15%', scale: 1.25 },
  full: { objectPosition: '50% 0%', scale: 1 },
}

export function OnboardingIntro({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const isLast = index === STEPS.length - 1

  function go(delta: number) {
    setDirection(delta)
    setIndex((i) => Math.min(Math.max(i + delta, 0), STEPS.length - 1))
  }

  function finish() {
    onComplete()
  }

  const step = STEPS[index]

  return (
    <div
      className="min-h-[80vh] w-full"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(29,19,64,1) 0%, rgba(18,13,38,1) 45%, rgba(7,7,12,1) 85%)',
      }}
    >
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-between px-6 py-8 md:px-12 md:py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
              T
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-white">Trust</span>
              <span className="text-violet-400">Saur</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="text-muted-foreground">
              Step {index + 1} of {STEPS.length}
            </span>
            <button onClick={finish} className="text-white underline-offset-2 hover:underline">
              Skip
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 items-center overflow-hidden py-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: 40 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 * direction }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex w-full flex-col-reverse items-center gap-10 md:flex-row md:items-center md:gap-14"
            >
              <div className="flex-1 space-y-4 text-center md:text-left">
                <p className="text-xs font-medium tracking-wider text-violet-400 uppercase">{step.eyebrow}</p>
                <h2 className="text-3xl leading-tight font-extrabold tracking-tight text-white md:text-5xl">
                  {step.title}
                </h2>
                <p className="mx-auto max-w-md text-base text-muted-foreground md:mx-0 md:text-lg">{step.body}</p>
              </div>

              <div className="relative flex h-64 w-64 shrink-0 items-center justify-center md:h-[360px] md:w-[360px]">
                <motion.div
                  className="absolute h-56 w-56 rounded-full bg-violet-500/30 blur-3xl md:h-72 md:w-72"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                  <Image
                    src="/mascot.jpg"
                    alt=""
                    width={400}
                    height={400}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: FOCUS_STYLES[step.focus].objectPosition,
                      transform: `scale(${FOCUS_STYLES[step.focus].scale})`,
                    }}
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > index ? 1 : -1)
                  setIndex(i)
                }}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-violet-500' : 'w-2 bg-white/15'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex justify-center gap-2 md:justify-end">
            {index > 0 && (
              <button
                onClick={() => go(-1)}
                className="h-12 w-[120px] max-w-full text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
              >
                Back
              </button>
            )}
            <Button
              size="sm"
              onClick={() => (isLast ? finish() : go(1))}
              className={`h-12 ${index > 0 ? 'w-[120px]' : 'w-[320px]'} max-w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400`}
            >
              {isLast ? 'Get started' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
