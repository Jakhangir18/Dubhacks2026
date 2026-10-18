"use client"

import Link from "next/link"
import { useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { Fredoka, Lilita_One } from "next/font/google"
import { House, Play, Sparkles, TrendingUp } from "lucide-react"
import { cn } from "cn"

export const lilita = Lilita_One({ subsets: ["latin"], weight: "400", variable: "--font-lilita" })
export const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fredoka" })

export const NAV = [
  { href: "/", label: "Overview", icon: House },
  { href: "/play", label: "Walk home", icon: Play },
  { href: "/progress", label: "My progress", icon: TrendingUp },
  { href: "/therapist", label: "Maya", icon: Sparkles },
]

export const VARIANTS = [
  { href: "/lab/a", label: "A · Night hero" },
  { href: "/lab/b", label: "B · Arcade night" },
  { href: "/lab/c", label: "C · Storybook" },
  { href: "/lab/d", label: "D · Night storybook" },
]

/** Floating switcher so the owner can flip between the three directions. */
export function VariantSwitch({ dark = false }: { dark?: boolean }) {
  const pathname = usePathname()
  return (
    <nav
      className={cn(
        "fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full p-1 text-sm font-semibold shadow-xl backdrop-blur",
        dark ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-white/90 text-[#173026] ring-1 ring-black/10",
      )}
      aria-label="Design variants"
    >
      {VARIANTS.map((variant) => {
        const active = pathname === variant.href
        return (
          <Link key={variant.href} href={variant.href} className="relative rounded-full px-4 py-2">
            {active ? (
              <motion.span
                layoutId="variant-pill"
                className={cn("absolute inset-0 rounded-full", dark ? "bg-[#9cff5a]" : "bg-[#173026]")}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className={cn("relative whitespace-nowrap", active && (dark ? "text-[#070b10]" : "text-white"))}>
              <span className="sm:hidden">{variant.label.slice(0, 1)}</span>
              <span className="hidden sm:inline">{variant.label}</span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Pointer parallax: children drift against the cursor; off under reduced motion. */
export function Parallax({ children, className, strength = 14 }: { children: ReactNode; className?: string; strength?: number }) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 120, damping: 20, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 120, damping: 20, mass: 0.6 })
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onPointerMove={(event) => {
        if (reduce) return
        const rect = event.currentTarget.getBoundingClientRect()
        px.set(((event.clientX - rect.left) / rect.width - 0.5) * -strength)
        py.set(((event.clientY - rect.top) / rect.height - 0.5) * -strength)
      }}
      onPointerLeave={() => {
        px.set(0)
        py.set(0)
      }}
    >
      <motion.div className="absolute -inset-6" style={{ x: sx, y: sy }}>
        {children}
      </motion.div>
    </div>
  )
}

/** Letters drop in one by one with a springy overshoot. */
export function PopTitle({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          aria-hidden="true"
          className="inline-block whitespace-pre"
          initial={reduce ? false : { y: 28, opacity: 0, scale: 0.6, rotate: -8 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 18, delay: delay + index * 0.035 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  )
}

/** Button that leans toward the cursor (magnetic hover). */
export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 300, damping: 18 })
  const y = useSpring(my, { stiffness: 300, damping: 18 })
  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x, y }}
      onPointerMove={(event) => {
        if (reduce || !ref.current) return
        const rect = ref.current.getBoundingClientRect()
        mx.set((event.clientX - rect.left - rect.width / 2) * 0.25)
        my.set((event.clientY - rect.top - rect.height / 2) * 0.35)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/** 3D tilt that follows the pointer, for cards. */
export function Tilt({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 200, damping: 18 })
  const sry = useSpring(ry, { stiffness: 200, damping: 18 })
  const shadow = useTransform(srx, [-max, max], ["0 18px 40px rgba(7,11,16,0.18)", "0 8px 20px rgba(7,11,16,0.12)"])
  return (
    <motion.div
      className={cn("[transform-style:preserve-3d]", className)}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900, boxShadow: shadow }}
      onPointerMove={(event) => {
        if (reduce) return
        const rect = event.currentTarget.getBoundingClientRect()
        ry.set(((event.clientX - rect.left) / rect.width - 0.5) * max * 2)
        rx.set(((event.clientY - rect.top) / rect.height - 0.5) * -max * 2)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/** Weekly minutes bars that spring up one after another. */
export function SpringBars({
  days,
  barClass,
  hotClass,
  labelClass,
}: {
  days: Array<{ key: string; label: string; minutes: number; isToday: boolean }>
  barClass: string
  hotClass: string
  labelClass?: string
}) {
  const reduce = useReducedMotion()
  const peak = Math.max(...days.map((day) => day.minutes), 1)
  return (
    <div className="flex h-24 items-end gap-2">
      {days.map((day, index) => {
        const height = day.minutes === 0 ? 10 : Math.max(18, (day.minutes / peak) * 100)
        const hot = day.minutes > 0 && day.minutes === peak
        return (
          <div key={day.key} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex h-16 w-full items-end">
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold opacity-0 transition group-hover:opacity-100">
                {day.minutes}m
              </span>
              <motion.div
                className={cn("mx-auto w-full max-w-7 origin-bottom rounded-md", hot ? hotClass : barClass)}
                style={{ height: `${height}%` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                whileHover={reduce ? undefined : { scaleY: 1.08 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.25 + index * 0.06 }}
              />
            </div>
            <span className={cn("text-[11px]", day.isToday ? "font-bold" : "opacity-70", labelClass)}>{day.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Sprite that bobs gently, like a game idle. */
export function Bob({ src, className, delay = 0, alt = "" }: { src: string; className?: string; delay?: number; alt?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("select-none", className)}
      animate={reduce ? undefined : { y: [0, -6, 0], rotate: [0, -2, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
    />
  )
}
