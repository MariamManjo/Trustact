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
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-between py-10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-violet-500">TrustSaur</span>
        <button
          onClick={finish}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Skip
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden py-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            initial={{ opacity: 0, x: 40 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * direction }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex w-full flex-col items-center text-center"
          >
            <div className="relative mb-8 flex h-72 w-72 items-center justify-center">
              <motion.div
                className="absolute h-72 w-72 rounded-full bg-violet-500/30 blur-3xl"
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute h-56 w-56 rounded-full bg-white/90 blur-3xl"
                animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.75, 0.5] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="relative h-72 w-72"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image
                  src="/mascot.jpg"
                  alt=""
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: FOCUS_STYLES[step.focus].objectPosition,
                    transform: `scale(${FOCUS_STYLES[step.focus].scale})`,
                    maskImage: 'radial-gradient(closest-side, black 45%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(closest-side, black 45%, transparent 75%)',
                  }}
                  priority
                />
              </motion.div>
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-violet-500">
              {step.eyebrow}
            </p>
            <h2 className="mb-3 max-w-md text-2xl font-semibold tracking-tight">{step.title}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{step.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > index ? 1 : -1)
                setIndex(i)
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-violet-500' : 'w-1.5 bg-white/15'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex justify-center gap-2">
          {index > 0 && (
            <Button variant="outline" size="sm" onClick={() => go(-1)} className="h-12 w-[150px] max-w-full">
              Back
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => (isLast ? finish() : go(1))}
            className={`h-12 ${index > 0 ? 'w-[150px]' : 'w-[320px]'} max-w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white hover:from-violet-400 hover:to-fuchsia-400`}
          >
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
