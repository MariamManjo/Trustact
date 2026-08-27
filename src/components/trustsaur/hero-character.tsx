'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

type Expression = 'happy' | 'squinting' | 'eyes-right' | 'eyes-left' | 'surprised' | 'winking' | 'angry'

const EXPRESSION_SRC: Record<Exclude<Expression, 'eyes-left'>, string> = {
  happy: '/hero/happy.png',
  squinting: '/hero/squinting.png',
  'eyes-right': '/hero/eyes-right.png',
  surprised: '/hero/surprised.png',
  winking: '/hero/winking.png',
  angry: '/hero/angry.png',
}

const IDLE_CYCLE: Expression[] = ['happy', 'squinting']
const CENTER_DEADZONE = 0.12

/**
 * Big, edge-anchored hero character — reacts to cursor position (eyes track
 * left/right), reacts to clicks (a quick surprised/wink burst, or an angry
 * flash on a rapid triple-click), and otherwise stays alive on its own via a
 * slow idle expression cycle. Never fully static.
 */
export function HeroCharacter() {
  const reduceMotion = useReducedMotion()
  const [idleIndex, setIdleIndex] = useState(0)
  const [lookDirection, setLookDirection] = useState<'left' | 'right' | null>(null)
  const [reaction, setReaction] = useState<Expression | null>(null)
  const [isDocked, setIsDocked] = useState(false)
  const clickTimesRef = useRef<number[]>([])
  const reactionTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const heroRef = useRef<HTMLDivElement>(null)

  // Docks into a small floating bubble once the in-flow hero has scrolled
  // out of view under the header, so the character is never lost — it just
  // never leaves the viewport instead of staying literally full-size fixed
  // (which would sit on top of the form underneath it).
  useEffect(() => {
    let ticking = false
    function checkDocked() {
      ticking = false
      const rect = heroRef.current?.getBoundingClientRect()
      if (!rect) return
      setIsDocked(rect.bottom < 72)
    }
    function handleScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(checkDocked)
    }
    checkDocked()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => setIdleIndex((i) => (i + 1) % IDLE_CYCLE.length), 4800)
    return () => clearInterval(id)
  }, [reduceMotion])

  useEffect(() => {
    if (reduceMotion) return
    function handleMove(e: MouseEvent) {
      const offset = e.clientX / window.innerWidth - 0.5
      if (Math.abs(offset) < CENTER_DEADZONE) {
        setLookDirection(null)
      } else {
        setLookDirection(offset > 0 ? 'right' : 'left')
      }
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [reduceMotion])

  useEffect(() => {
    return () => reactionTimeoutsRef.current.forEach(clearTimeout)
  }, [])

  function handleClick() {
    const now = Date.now()
    clickTimesRef.current = [...clickTimesRef.current, now].filter((t) => now - t < 1200)
    reactionTimeoutsRef.current.forEach(clearTimeout)
    reactionTimeoutsRef.current = []

    if (clickTimesRef.current.length >= 3) {
      clickTimesRef.current = []
      setReaction('angry')
      reactionTimeoutsRef.current.push(setTimeout(() => setReaction(null), 900))
      return
    }

    setReaction('surprised')
    reactionTimeoutsRef.current.push(
      setTimeout(() => setReaction('winking'), 350),
      setTimeout(() => setReaction(null), 900)
    )
  }

  const expression: Expression = reaction ?? (lookDirection === 'right' ? 'eyes-right' : lookDirection === 'left' ? 'eyes-left' : IDLE_CYCLE[idleIndex])
  const mirrored = expression === 'eyes-left'
  const src = EXPRESSION_SRC[mirrored ? 'eyes-right' : expression]

  const dockedBubble = (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <AnimatePresence>
        {isDocked && (
          <motion.button
            type="button"
            aria-label="Trustact mascot"
            onClick={handleClick}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-[#0a0710]/90 shadow-[0_8px_30px_rgba(139,92,246,0.45)] backdrop-blur-xl sm:h-20 sm:w-20"
          >
            <motion.div
              key={expression}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative h-full w-full"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="80px"
                className="object-contain object-bottom p-1.5"
                style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
              />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <Fragment>
    <motion.div
      ref={heroRef}
      initial={reduceMotion ? undefined : { opacity: 0, y: 60 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      onClick={handleClick}
      className="relative -mx-4 -mb-2 flex h-[320px] cursor-pointer justify-center overflow-hidden sm:h-[400px] md:h-[480px]"
    >
      <motion.div
        className="absolute bottom-0 h-[110%] w-[70%] rounded-full bg-violet-500/25 blur-3xl"
        animate={reduceMotion ? undefined : { opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        key={expression}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative h-full w-full max-w-[420px]"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 768px) 420px, 320px"
          className="object-contain object-bottom drop-shadow-[0_25px_45px_rgba(139,92,246,0.4)]"
          style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
          priority
        />
      </motion.div>

      <motion.button
        type="button"
        aria-label="Scroll down"
        onClick={(e) => {
          e.stopPropagation()
          document.getElementById('agent-action-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
        className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-violet-300/70 transition-colors hover:text-violet-200"
        animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="h-6 w-6" />
      </motion.button>
    </motion.div>
    {typeof document !== 'undefined' && createPortal(dockedBubble, document.body)}
    </Fragment>
  )
}
