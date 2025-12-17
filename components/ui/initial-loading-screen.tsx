'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

export function InitialLoadingScreen({
  onComplete
}: {
  onComplete: () => void
}) {
  const [phase, setPhase] = useState(0)
  const [showText, setShowText] = useState(false)

  useEffect(() => {
    // Animation sequence
    const timer1 = setTimeout(() => setPhase(1), 100)    // Start progress bar
    const timer2 = setTimeout(() => setPhase(2), 800)    // Show logo reveal
    const timer3 = setTimeout(() => setPhase(3), 1500)   // Show first text
    const timer4 = setTimeout(() => setPhase(4), 2200)   // Transition to second text
    const timer5 = setTimeout(() => setPhase(5), 2800)   // Hide everything
    const timer6 = setTimeout(() => onComplete(), 3500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
      clearTimeout(timer5)
      clearTimeout(timer6)
    }
  }, [onComplete])

  const firstText = "Hold tight"
  const secondText = "Hi there!"
  const firstLetters = firstText.split('')
  const secondLetters = secondText.split('')

  return (
    <motion.div
      key={phase >= 5 ? 'exit' : 'enter'}
      initial={phase >= 5 ? { y: 0 } : { opacity: 0 }}
      animate={phase >= 5 ? { y: '-100%' } : { opacity: 1 }}
      transition={phase >= 5 ? { duration: 0.4, ease: 'easeInOut' } : { duration: 0.3 }}
      className="fixed inset-0 z-50 text-foreground"
    >
        {/* Background - pure white */}
        <div className="absolute inset-0 bg-white" />

        {/* Progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-2 bg-white origin-left"
          initial={{ scaleX: 0 }}
          animate={phase >= 1 ? { scaleX: 1 } : {}}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
        />

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
          {/* Logo section */}
          <div className="relative mb-16">
            {/* Base logo (faded) */}
            <div className="relative opacity-20">
              <motion.img
                src="/logo/59b3f6b6c3c46621b356d5f49bb6efe368efa9ad.png"
                alt="Logo"
                className="w-48 h-12 object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Top logo (clipped reveal) */}
            <motion.div
              className="absolute inset-0 overflow-hidden"
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={phase >= 2 ? { clipPath: 'inset(0 0% 0 0)' } : {}}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            >
              <motion.img
                src="/logo/59b3f6b6c3c46621b356d5f49bb6efe368efa9ad.png"
                alt="Logo"
                className="w-48 h-12 object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              />
            </motion.div>
          </div>

          {/* Text animation */}
          <div className="relative h-8 overflow-hidden">
            {/* First text */}
            <AnimatePresence>
              {phase >= 3 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex justify-center items-center font-mono uppercase text-lg tracking-wider"
                >
                  {firstLetters.map((letter, index) => (
                    <motion.span
                      key={`first-${index}`}
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.03,
                        ease: 'easeOut'
                      }}
                      className="inline-block"
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Second text */}
            <AnimatePresence>
              {phase >= 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex justify-center items-center font-mono uppercase text-lg tracking-wider"
                >
                  {secondLetters.map((letter, index) => (
                    <motion.span
                      key={`second-${index}`}
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.03,
                        ease: 'easeOut'
                      }}
                      className="inline-block"
                    >
                      {letter === ' ' ? '\u00A0' : letter}
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </motion.div>
  )
}


