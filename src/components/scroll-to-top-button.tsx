'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

/** Appears once the page has scrolled down a bit; scrolls back to top on click. */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let ticking = false
    function check() {
      ticking = false
      setVisible(window.scrollY > 400)
    }
    function handleScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed right-4 bottom-4 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-[#0a0710]/90 text-violet-300 shadow-[0_8px_24px_rgba(139,92,246,0.35)] backdrop-blur-xl transition-colors hover:text-violet-200"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
