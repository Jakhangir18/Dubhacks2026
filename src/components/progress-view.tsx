"use client"

import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatWhen } from "@/lib/format"
import { sticker, type StickerTone } from "@/lib/sticker"
import { useStride } from "@/lib/store"
import { cn } from "cn"

const RANGES = [
  { id: "14", label: "14 days", days: 14 },
  { id: "30", label: "30 days", days: 30 },
  { id: "all", label: "All", days: null },
] as const

const EASE_OUT = [0.22, 1, 0.36, 1] as const

export function ProgressView() {
  const { state, derived } = useStride()
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("14")
  const [active, setActive] = useState<number | null>(null)
  const selected = RANGES.find((item) => item.id === range) ?? RANGES[0]
  const points = useMemo(() => {
    const cutoff = selected.days
      ? derived.now.getTime() - selected.days * 24 * 60 * 60 * 1000
      : 0
    return derived.recent
      .filter((session) => new Date(session.playedAt).getTime() >= cutoff)
      .slice()
      .reverse()
  }, [derived.now, derived.recent, selected.days])

  const latest = derived.latest
  const bestPace = Math.max(...state.sessions.map((session) => session.pace), 0)
  const bestSymmetry = Math.max(...state.sessions.map((session) => session.symmetry), 0)
  const goalPct = Math.min(100, Math.round((derived.weekMinutes / state.weeklyGoalMin) * 100))

  return (
    <div>
      <PageHeader
        eyebrow="SCORES"
        title="My progress"
        subtitle="Walking score is pace and symmetry together. Both come from the trackpad."
      />

      <section className="grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
        <Stat
          tone="teal"
          label="WALKING SCORE"
          labelClass="text-[#2de2c4]"
          numberClass="text-[#9cff5a]"
          value={derived.walkingScore}
          hint={`${derived.scoreDelta > 0 ? "+" : ""}${derived.scoreDelta}% vs the prior five`}
          delay={0.1}
          tilt={-1.5}
        />
        <Stat
          tone="violet"
          label="THIS WEEK"
          labelClass="text-[#c9a8ff]"
          numberClass="text-white"
          value={derived.weekMinutes}
          unit="min"
          hint={`${state.weeklyGoalMin} minute goal`}
          delay={0.16}
          tilt={1.5}
        />
        <Stat
          tone="amber"
          label="STREAK"
          labelClass="text-[#ffb21e]"
          numberClass="text-[#ffd76a]"
          value={derived.streak}
          unit="days"
          hint={`Best ${state.bestStreak}`}
          delay={0.22}
          tilt={-1.5}
        />
        <Stat
          tone="lime"
          label="LATEST SYMMETRY"
          labelClass="text-[#9cff5a]"
          numberClass="text-[#2de2ff]"
          value={latest ? latest.symmetry : null}
          hint={latest ? latest.levelName : "No walks yet"}
          delay={0.28}
          tilt={1.5}
        />
      </section>

      <BlurFade delay={0.34}>
        <section className={sticker("ink", "mt-5 p-5 sm:p-6")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-outline text-2xl tracking-wide text-white">WALKING SCORE</h2>
              <p className="text-sm text-white/60">Each point is a scored walk.</p>
            </div>
            <div className="flex rounded-full border-[2.5px] border-[#2c4639] bg-[#070b10] p-1" role="tablist" aria-label="Score range">
              {RANGES.map((item) => {
                const on = range === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setRange(item.id)
                      setActive(null)
                    }}
                    className={cn(
                      "relative rounded-full px-3.5 py-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#9cff5a]/70",
                      on ? "text-[#0b1a14]" : "text-white/70 hover:text-white",
                    )}
                  >
                    {on ? (
                      <motion.span
                        layoutId="score-range-pill"
                        className="absolute inset-0 rounded-full bg-[#9cff5a] shadow-[0_3px_0_#3d7a19]"
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {points.length === 0 ? (
            <p className="mt-10 mb-6 text-sm text-white/60">No scored walks in this window.</p>
          ) : (
            <ScoreChart
              points={points.map((session) => ({
                label: formatWhen(session.playedAt, derived.now),
                score: session.walkingScore,
                name: session.levelName,
              }))}
              active={active}
              onActive={setActive}
            />
          )}
        </section>
      </BlurFade>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <MetricCard
          tone="amber"
          label="PACE"
          titleClass="text-[#ffb21e]"
          numberClass="text-[#ffd76a]"
          fillClass="bg-[linear-gradient(90deg,#a8690b,#ffb21e_70%,#ffd76a)]"
          value={latest?.pace ?? 0}
          best={bestPace}
          note="Cadence from the trackpad. Rushing the last third is the usual leak."
          delay={0.42}
        />
        <MetricCard
          tone="teal"
          label="SYMMETRY"
          titleClass="text-[#2de2c4]"
          numberClass="text-[#2de2ff]"
          fillClass="bg-[linear-gradient(90deg,#17806f,#2de2c4_70%,#2de2ff)]"
          value={latest?.symmetry ?? 0}
          best={bestSymmetry}
          note="Left and right sharing the work. A longer step on one side shows up here."
          delay={0.48}
        />
      </section>

      <BlurFade delay={0.56}>
        <section className={sticker("violet", "mt-5 p-5 sm:p-6")}>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2 className="font-display text-outline text-2xl tracking-wide text-white">WEEKLY MINUTES</h2>
              <p className="mt-0.5 text-sm text-white/70">
                {derived.weekMinutes} of {state.weeklyGoalMin} minutes. Last week was {derived.lastWeekMinutes}.
              </p>
            </div>
            <Link href="/activity" className="inline-flex items-center gap-1 text-sm font-semibold text-[#9cff5a] hover:underline">
              Review sessions <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Meter
              pct={goalPct}
              fillClass="bg-[linear-gradient(90deg,#5b3a99,#a46bff_65%,#ffb21e)]"
              delay={0.75}
              className="h-5 flex-1"
            />
            <span className="font-display text-outline w-14 text-right text-2xl text-[#ffd76a] tabular-nums">{goalPct}%</span>
          </div>
        </section>
      </BlurFade>
    </div>
  )
}

/** Count-up number; under reduced motion the CSS swaps in the static value. */
function Count({ value, delay }: { value: number; delay: number }) {
  return (
    <>
      <NumberTicker value={value} delay={delay} className="motion-reduce:hidden" />
      <span className="hidden tabular-nums motion-reduce:inline">{value}</span>
    </>
  )
}

function Stat({
  tone,
  label,
  labelClass,
  numberClass,
  value,
  unit,
  hint,
  delay,
  tilt,
}: {
  tone: StickerTone
  label: string
  labelClass: string
  numberClass: string
  value: number | null
  unit?: string
  hint: string
  delay: number
  tilt: number
}) {
  return (
    <BlurFade delay={delay}>
      <motion.article whileHover={{ rotate: tilt, y: -4 }} className={sticker(tone, "h-full p-4 sm:p-5")}>
        <p className={cn("text-[11px] font-bold tracking-[0.16em]", labelClass)}>{label}</p>
        <p className={cn("font-display text-outline mt-1 text-4xl leading-none tabular-nums sm:text-5xl", numberClass)}>
          {value === null ? "—" : <Count value={value} delay={delay + 0.3} />}
          {unit ? <span className="ml-1.5 text-xl sm:text-2xl">{unit}</span> : null}
        </p>
        <p className="mt-2 text-sm leading-5 text-white/65">{hint}</p>
      </motion.article>
    </BlurFade>
  )
}

/** Chunky track whose fill slides in from the left with a spring (transform only). */
function Meter({ pct, fillClass, delay, className }: { pct: number; fillClass: string; delay: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      className={cn("relative h-4 overflow-hidden rounded-full border-[2.5px] border-[#0b1a14] bg-[#14242a]", className)}
      aria-hidden="true"
    >
      <motion.div
        className={cn("h-full w-full rounded-full", fillClass)}
        initial={{ x: "-100%" }}
        animate={{ x: `${clamped - 100}%` }}
        transition={{ type: "spring", bounce: 0.2, duration: 1.1, delay }}
      />
    </div>
  )
}

function MetricCard({
  tone,
  label,
  titleClass,
  numberClass,
  fillClass,
  value,
  best,
  note,
  delay,
}: {
  tone: StickerTone
  label: string
  titleClass: string
  numberClass: string
  fillClass: string
  value: number
  best: number
  note: string
  delay: number
}) {
  return (
    <BlurFade delay={delay}>
      <motion.article whileHover={{ y: -4 }} className={sticker(tone, "h-full p-5")}>
        <div className="flex items-end justify-between gap-3">
          <h3 className={cn("font-display text-2xl tracking-wide", titleClass)}>{label}</h3>
          <p className={cn("font-display text-outline text-5xl leading-none tabular-nums", numberClass)}>
            {value || "—"}
          </p>
        </div>
        <Meter pct={value} fillClass={fillClass} delay={delay + 0.35} className="mt-3" />
        <p className="mt-2 text-xs font-bold tracking-[0.12em] text-white/60">BEST {best || "—"}</p>
        <p className="mt-2 text-sm leading-6 text-white/70">{note}</p>
      </motion.article>
    </BlurFade>
  )
}

function ScoreChart({
  points,
  active,
  onActive,
}: {
  points: { label: string; score: number; name: string }[]
  active: number | null
  onActive: (index: number | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const gradientId = `score-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

  // Draw the SVG at the container's real pixel width so text and dots never shrink on phones.
  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(260, Math.round(entry.contentRect.width)))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const height = 260
  const padLeft = 34
  const padRight = 18
  const padTop = 44
  const padBottom = 30
  const lowest = Math.min(60, ...points.map((point) => point.score))
  const min = Math.max(0, Math.floor(lowest / 10) * 10)
  const max = 100
  const marks = [min + Math.round((max - min) / 4), min + Math.round((max - min) / 2), min + Math.round((3 * (max - min)) / 4)]
  const toY = (score: number) => padTop + (1 - (Math.min(max, Math.max(min, score)) - min) / (max - min)) * (height - padTop - padBottom)
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padLeft + (index * (width - padLeft - padRight)) / (points.length - 1)
    return { ...point, x, y: toY(point.score) }
  })
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const baseline = height - padBottom
  const area = `${line} L ${coords[coords.length - 1].x} ${baseline} L ${coords[0].x} ${baseline} Z`
  const currentIndex = active ?? coords.length - 1
  const current = coords[currentIndex]
  // Re-run the draw-in whenever the plotted series changes (range switch, new walk).
  const drawKey = points.map((point) => `${point.label}:${point.score}`).join("|")
  const popStep = Math.min(0.08, 0.9 / Math.max(points.length, 1))
  const first = coords[0]
  const last = coords[coords.length - 1]

  return (
    <div className="mt-4">
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-2xl border-[2.5px] border-[#1b2f27] bg-[#070b10] bg-[linear-gradient(rgba(45,226,196,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(45,226,196,0.06)_1px,transparent_1px)] bg-[size:22px_22px]"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-[260px] w-full"
          role="img"
          aria-label="Walking scores over time"
          onMouseLeave={() => onActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#9cff5a" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#9cff5a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {marks.map((mark) => {
            const y = toY(mark)
            return (
              <g key={mark}>
                <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#2c4639" strokeDasharray="4 6" />
                <text x={6} y={y + 4} fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600">
                  {mark}
                </text>
              </g>
            )
          })}
          <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="#2c4639" strokeWidth="1.5" />
          <text x={first.x} y={height - 9} fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600" textAnchor={coords.length === 1 ? "middle" : "start"}>
            {first.label}
          </text>
          {coords.length > 1 ? (
            <text x={last.x} y={height - 9} fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600" textAnchor="end">
              {last.label}
            </text>
          ) : null}

          <g key={drawKey}>
            <motion.path
              d={area}
              fill={`url(#${gradientId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            />
            {/* Soft glow: a wide, faint copy of the line under the crisp one. */}
            <motion.path
              d={line}
              fill="none"
              stroke="#9cff5a"
              strokeOpacity="0.22"
              strokeWidth="10"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="motion-reduce:[stroke-dasharray:none]"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: EASE_OUT }}
            />
            <motion.path
              d={line}
              fill="none"
              stroke="#9cff5a"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="motion-reduce:[stroke-dasharray:none]"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: EASE_OUT }}
            />
            {current ? (
              <line
                x1={current.x}
                x2={current.x}
                y1={current.y}
                y2={baseline}
                stroke="#ffb21e"
                strokeOpacity="0.6"
                strokeWidth="1.5"
                strokeDasharray="3 5"
              />
            ) : null}
            {coords.map((point, index) => {
              const on = index === currentIndex
              return (
                <motion.g
                  key={`${point.label}-${index}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 14, delay: 0.3 + index * popStep }}
                >
                  <motion.circle
                    cx={point.x}
                    cy={point.y}
                    r={5}
                    fill={on ? "#ffb21e" : "#0b1a14"}
                    stroke={on ? "#0b1a14" : "#9cff5a"}
                    strokeWidth={2.5}
                    animate={{ scale: on ? 1.5 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  />
                </motion.g>
              )
            })}
          </g>
          {coords.map((point, index) => (
            <circle
              key={`hit-${point.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r="14"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => onActive(index)}
              onClick={() => onActive(index)}
            >
              <title>{`${point.name}, ${point.score}`}</title>
            </circle>
          ))}
        </svg>
        {current ? (
          <motion.div
            key={`tag-${currentIndex}-${drawKey}`}
            className="font-display pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border-2 border-[#0b1a14] bg-[#ffb21e] px-2 py-0.5 text-lg leading-tight text-[#0b1a14] tabular-nums shadow-[3px_3px_0_#a8690b]"
            style={{ left: Math.min(Math.max(current.x, 28), width - 28), top: current.y - 12 }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 20, delay: active === null ? 1 : 0 }}
            aria-hidden="true"
          >
            {current.score}
          </motion.div>
        ) : null}
      </div>
      {current ? (
        <p className="mt-3 text-sm text-white/70" aria-live="polite">
          <span className="font-display text-lg text-[#9cff5a] tabular-nums">{current.score}</span> on {current.name} · {current.label}
        </p>
      ) : null}
    </div>
  )
}
