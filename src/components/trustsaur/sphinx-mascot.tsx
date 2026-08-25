'use client'

import { motion } from 'framer-motion'

interface SphinxMascotProps {
  className?: string
  bounce?: boolean
  mood?: 'idle' | 'thinking' | 'happy' | 'sad'
}

const SKIN = '#f2a9a0'
const SKIN_SHADOW = '#d98d84'

export function SphinxMascot({ className = 'h-11 w-11', bounce = false, mood = 'idle' }: SphinxMascotProps) {
  const isHappy = mood === 'happy'
  const isSad = mood === 'sad'
  const isThinking = mood === 'thinking'

  return (
    <motion.svg
      viewBox="0 0 240 240"
      className={className}
      animate={bounce ? { y: [0, -6, 0] } : undefined}
      transition={bounce ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      {/* ears */}
      <path d="M 62 88 L 18 8 Q 12 -2 24 4 L 98 68 Z" fill={SKIN} />
      <path d="M 178 88 L 222 8 Q 228 -2 216 4 L 142 68 Z" fill={SKIN} />
      <path d="M 68 82 L 32 20 L 90 66 Z" fill={SKIN_SHADOW} opacity={0.5} />
      <path d="M 172 82 L 208 20 L 150 66 Z" fill={SKIN_SHADOW} opacity={0.5} />

      {/* head */}
      <ellipse cx="120" cy="150" rx="96" ry="84" fill={SKIN} />

      {/* eyes */}
      {isThinking ? (
        <>
          <path d="M 66 138 Q 92 122 118 138" stroke="#3a2420" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M 122 138 Q 148 122 174 138" stroke="#3a2420" strokeWidth="7" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="90" cy="140" rx="27" ry={isSad ? 24 : 30} fill="white" />
          <ellipse cx="150" cy="140" rx="27" ry={isSad ? 24 : 30} fill="white" />

          <motion.circle
            cx={90}
            cy={isHappy ? 150 : 146}
            r={isHappy ? 10 : 13}
            fill="#241512"
            animate={{ cx: [88, 92, 88] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.circle
            cx={150}
            cy={isHappy ? 150 : 146}
            r={isHappy ? 10 : 13}
            fill="#241512"
            animate={{ cx: [148, 152, 148] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* blinking eyelids */}
          <motion.rect
            x={62}
            y={108}
            width={56}
            height={40}
            fill={SKIN}
            style={{ transformOrigin: '90px 108px' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 0, 1, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.92, 0.96, 1], ease: 'easeInOut' }}
          />
          <motion.rect
            x={122}
            y={108}
            width={56}
            height={40}
            fill={SKIN}
            style={{ transformOrigin: '150px 108px' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: [0, 0, 1, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.92, 0.96, 1], ease: 'easeInOut', delay: 0.03 }}
          />
        </>
      )}

      {/* nose */}
      <path d="M 110 178 L 130 178 L 120 191 Z" fill={SKIN_SHADOW} />

      {/* mouth */}
      {isHappy ? (
        <path d="M 96 196 Q 120 216 144 196" stroke={SKIN_SHADOW} strokeWidth="5" fill="none" strokeLinecap="round" />
      ) : isSad ? (
        <path d="M 96 206 Q 120 192 144 206" stroke={SKIN_SHADOW} strokeWidth="5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M 102 197 Q 120 206 138 197" stroke={SKIN_SHADOW} strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
    </motion.svg>
  )
}
