'use client'

import { type MouseEvent } from 'react'
import Image from 'next/image'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

interface TiltCharacterProps {
  src: string
  alt: string
  /** Tailwind size classes for the outer frame, e.g. "h-64 w-64 md:h-[380px] md:w-[380px]". */
  sizeClassName: string
  /** Continuous idle sway — use for a hero character, skip for small inline avatars. */
  idle?: boolean
  priority?: boolean
}

/**
 * Character art tilts/lifts toward the cursor instead of sitting static, and
 * optionally sways in place so it reads as "alive" even before the cursor
 * gets near it. Both motions are dropped under prefers-reduced-motion.
 */
export function TiltCharacter({ src, alt, sizeClassName, idle = false, priority = false }: TiltCharacterProps) {
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const spring = { stiffness: 150, damping: 15, mass: 0.5 }
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [14, -14]), spring)
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-14, 14]), spring)
  const translateX = useSpring(useTransform(x, [-0.5, 0.5], [-12, 12]), spring)
  const translateY = useSpring(useTransform(y, [-0.5, 0.5], [-12, 12]), spring)

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${sizeClassName}`}
      style={{ perspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="absolute h-[70%] w-[70%] rounded-full bg-violet-500/25 blur-3xl"
        animate={reduceMotion ? undefined : { scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="relative h-full w-full"
        style={{ rotateX, rotateY, x: translateX, y: translateY, transformStyle: 'preserve-3d' }}
      >
        <motion.div
          className="relative h-full w-full"
          animate={idle && !reduceMotion ? { y: [0, -10, 0], rotate: [-2, 2, -2] } : undefined}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 768px) 380px, 256px"
            className="object-contain drop-shadow-[0_25px_45px_rgba(139,92,246,0.35)]"
            priority={priority}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
