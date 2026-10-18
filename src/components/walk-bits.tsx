"use client"

/** Small pieces every page shares: the stacked numbers, the plain words about a walk, a moment card,
 * the review's state chip and the demo tag. */

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { Check, Sparkles, TriangleAlert } from "lucide-react"
import type { Moment } from "@/lib/game"
import { sticker, type StickerTone } from "@/lib/sticker"
import { clock, reviewState, wentWell, workOn, type Walk } from "@/lib/walks"
import { cn } from "cn"

export const LEFT = "#2de2ff"
export const RIGHT = "#ff3d8b"

export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border-2 border-[#ffb21e]/70 bg-[#2a1f0e] px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-[#ffd76a]", className)}
      title="The game server has no walks for this player yet: these are demo walks."
    >
      DEMO
    </span>
  )
}

export function ReviewChip({ walk, className }: { walk: Walk; className?: string }) {
  const state = reviewState(walk)
  const tone = {
    done: "border-[#9cff5a]/60 bg-[#12261a] text-[#9cff5a]",
    waiting: "border-[#ffb21e]/60 bg-[#2a1f0e] text-[#ffd76a]",
    reviewing: "border-[#a46bff]/60 bg-[#1f1630] text-[#c9a8ff]",
    failed: "border-[#ff3d8b]/60 bg-[#2a1220] text-[#ff8fbf]",
    none: "border-white/15 bg-white/5 text-white/60",
  }[state.kind]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold", tone, className)}>
      {state.kind === "done" ? <Sparkles className="size-3" /> : null}
      {state.kind === "reviewing" || state.kind === "waiting" ? <span className="size-2 animate-pulse rounded-full bg-current motion-reduce:animate-none" /> : null}
      {state.label}
    </span>
  )
}

export type Figure = { label: string; value: string | number | null; unit?: string; hint?: string; tone?: "lime" | "amber" | "teal" | "violet" | "rose" | "white" }

const FIGURE_TONE = {
  lime: "text-[#9cff5a]",
  amber: "text-[#ffd76a]",
  teal: "text-[#2de2c4]",
  violet: "text-[#c9a8ff]",
  rose: "text-[#ff8fbf]",
  white: "text-white",
}

/** The numbers, stacked: a label above each value; a null value is left out so nothing reads as broken. */
export function NumberGrid({ figures, className, delay = 0 }: { figures: Figure[]; className?: string; delay?: number }) {
  const shown = figures.filter((figure) => figure.value !== null && figure.value !== "")
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3", className)}>
      {shown.map((figure, index) => (
        <motion.div
          key={figure.label}
          className="min-w-0 rounded-2xl bg-black/25 px-3 py-2.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + index * 0.04, type: "spring", stiffness: 420, damping: 26 }}
        >
          <dt className="truncate text-[10px] font-bold tracking-[0.14em] text-white/55 uppercase">{figure.label}</dt>
          <dd className={cn("font-display mt-0.5 text-2xl leading-none tabular-nums sm:text-3xl", FIGURE_TONE[figure.tone ?? "white"])}>
            {figure.value}
            {figure.unit && figure.value !== "–" ? <span className="ml-1 text-sm text-white/55">{figure.unit}</span> : null}
          </dd>
          {figure.hint ? <dd className="mt-0.5 truncate text-[11px] text-white/50">{figure.hint}</dd> : null}
        </motion.div>
      ))}
    </dl>
  )
}

export function sidesLabel(sides: { L: number | null; R: number | null }, digits = 0) {
  if (sides.L === null && sides.R === null) return null
  const one = (value: number | null) => (value === null ? "–" : value.toFixed(digits))
  return `${one(sides.L)} / ${one(sides.R)}`
}

/** The figures a walk always has, in the order the player reads them. */
export function walkFigures(walk: Walk): Figure[] {
  return [
    { label: "Flowers hit", value: walk.flowersPct, unit: "%", tone: "lime" },
    { label: "Steps", value: walk.steps, tone: "white" },
    { label: "Cadence", value: walk.cadence, unit: "/min", tone: "amber" },
    { label: "Even L / R", value: walk.evenPct, unit: "%", tone: "teal" },
    { label: "Knee bend L / R", value: sidesLabel(walk.kneeDeg), unit: "°", tone: "violet", hint: "side camera" },
    { label: "Golden flowers", value: walk.goldenPct, unit: "%", tone: "amber" },
    { label: "Petals", value: walk.petals, tone: "rose" },
    { label: "Rounds", value: walk.rounds, tone: "white" },
    { label: "Seeds dodged", value: walk.seedAct ? walk.seedsPct : null, unit: "%", tone: "teal" },
    { label: "Form", value: walk.formPct, unit: "%", tone: "white", hint: "pace, both feet, evenness" },
  ]
}

/** What went well, and the one thing to work on next. */
export function WalkWords({ walk, moments = [], compact = false, className }: { walk: Walk; moments?: Moment[]; compact?: boolean; className?: string }) {
  const good = wentWell(walk)
  const next = workOn(walk, moments)
  return (
    <div className={cn("grid gap-3", !compact && "sm:grid-cols-2", className)}>
      <motion.div
        className="rounded-2xl border-[2.5px] border-[#9cff5a]/50 bg-[#12261a]/80 p-4"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.2 }}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-[#9cff5a]">
          <Check className="size-3.5" strokeWidth={3} /> WHAT WENT WELL
        </p>
        <p className={cn("mt-1.5 leading-6 text-white/90", compact ? "text-[15px]" : "text-base")}>{good}</p>
      </motion.div>
      <motion.div
        className="rounded-2xl border-[2.5px] border-[#ffb21e]/50 bg-[#2a1f0e]/80 p-4"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.3 }}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">
          <TriangleAlert className="size-3.5" strokeWidth={3} /> WORK ON NEXT
        </p>
        <p className={cn("mt-1.5 font-semibold leading-6 text-[#ffd76a]", compact ? "text-[15px]" : "text-base")}>{next.text}</p>
        {next.why ? <p className="mt-1 text-sm leading-5 text-white/65">{next.why}</p> : null}
      </motion.div>
    </div>
  )
}

const MOMENT_TONE: Record<Moment["momentKind"], StickerTone> = { knee_low: "amber", uneven: "violet", good: "lime" }
const MOMENT_WORD: Record<Moment["momentKind"], string> = { knee_low: "KNEE LOW", uneven: "UNEVEN", good: "NICE STEP" }

/** One moment from the side camera: the picture with the skeleton drawn, the title and the plain explanation. */
export function MomentCard({ moment, href, delay = 0, className }: { moment: Moment; href?: string; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  const side = moment.side === "L" ? "left" : moment.side === "R" ? "right" : null
  const degrees = moment.valueDeg !== null ? `${Math.round(moment.valueDeg)}°${moment.targetDeg !== null ? ` · target ${Math.round(moment.targetDeg)}°` : ""}` : null
  const body = (
    <motion.article
      layout={!reduce}
      className={sticker(MOMENT_TONE[moment.momentKind], cn("flex h-full flex-col overflow-hidden rounded-[22px] p-0", className))}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 24, delay }}
      whileHover={href ? { y: -3 } : undefined}
    >
      <div className="relative aspect-[4/3] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={moment.img} alt={moment.title} className="size-full object-contain" loading="lazy" />
        <span className="absolute top-2 left-2 rounded-full border-2 border-[#0b1a14] bg-[#ffd76a] px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-[#0b1a14]">
          {MOMENT_WORD[moment.momentKind]}
          {side ? ` · ${side.toUpperCase()}` : ""}
        </span>
        <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white/85">{clock(moment.t)}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-display text-xl leading-tight tracking-wide text-[#ffd76a]">{moment.title}</p>
        <p className="mt-1.5 text-sm leading-5 text-white/80">{moment.explain}</p>
        {degrees ? (
          <p className="mt-2 text-xs font-semibold text-white/60" style={{ color: moment.side === "L" ? LEFT : moment.side === "R" ? RIGHT : undefined }}>
            {side ? `${side} knee ` : ""}
            {degrees}
          </p>
        ) : null}
      </div>
    </motion.article>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}

export function EmptyNote({ title, body, className }: { title: string; body: string; className?: string }) {
  return (
    <div className={cn(sticker("ink", "border-dashed px-6 py-10 text-center"), className)}>
      <p className="font-display text-2xl tracking-wide text-[#ffd76a]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-white/65">{body}</p>
    </div>
  )
}
