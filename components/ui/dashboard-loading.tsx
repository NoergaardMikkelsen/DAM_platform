'use client'

import { motion } from 'framer-motion'

export function DashboardLoading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-6">
          {/* Blur text animation */}
          <motion.div
            initial={{ filter: 'blur(10px)', opacity: 0 }}
            animate={{ filter: 'blur(0px)', opacity: 1 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut'
            }}
            className="text-2xl font-medium text-muted-foreground"
          >
            Loading dashboard...
          </motion.div>

          {/* Simple spinner */}
          <motion.div
            className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>
    </div>
  )
}