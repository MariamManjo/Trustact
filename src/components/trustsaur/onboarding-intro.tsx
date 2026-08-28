'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { TiltCharacter } from './tilt-character'

interface Step {
  eyebrow: string
  title: string
  body: string
  image: string
}

const STEPS: Step[] = [
  {
    eyebrow: '1. The problem',
    title: 'Your AI agent is about to spend your money.',
    body: 'It acts on what it knows — not on what’s true right now.',
    image: '/onboarding/walking.png',
  },
  {
    eyebrow: '2. The risk',
    title: 'It could be wrong, and it won’t slow down.',
    body: 'No model knows if that table’s still open, or that price still holds.',
    image: '/onboarding/running.png',
  },
  {
    eyebrow: '3. The fix',
    title: 'One real human checks first.',
    body: 'A live question, answered in seconds, by someone who actually knows.',
    image: '/onboarding/landing.png',
  },
  {
    eyebrow: '4. The payout',
    title: 'Verified, then paid — automatically.',
    body: 'The moment it’s confirmed, payment fires on-chain in SOL. No native token, no extra step.',
    image: '/onboarding/jumping.png',
  },
]

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
        <div className="flex items-center gap-4">
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
                  style={{ width: i <= index ? '100%' : '0%' }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={finish}
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-white"
          >
            Skip
          </button>
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

              <TiltCharacter src={step.image} alt="" sizeClassName="h-64 w-64 md:h-[380px] md:w-[380px]" idle priority />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="space-y-4">
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
