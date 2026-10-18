"use client"

import type { ReactNode } from "react"
import { motion } from "motion/react"

/** Every page rises in softly; MotionConfig turns this off under reduced motion. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}
