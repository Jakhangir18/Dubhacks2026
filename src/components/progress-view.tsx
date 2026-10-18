"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { formatWhen } from "@/lib/format"
import { useStride } from "@/lib/store"
import { cn } from "cn"

const RANGES = [
  { id: "14", label: "14 days", days: 14 },
  { id: "30", label: "30 days", days: 30 },
  { id: "all", label: "All", days: null },
] as const

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Walking score" value={String(derived.walkingScore)} hint={`${derived.scoreDelta > 0 ? "+" : ""}${derived.scoreDelta}% vs the prior five`} />
        <Stat label="This week" value={`${derived.weekMinutes} min`} hint={`${state.weeklyGoalMin} minute goal`} />
        <Stat label="Streak" value={`${derived.streak} days`} hint={`Best ${state.bestStreak}`} />
        <Stat label="Latest symmetry" value={latest ? String(latest.symmetry) : "—"} hint={latest ? latest.levelName : "No walks yet"} />
      </section>

      <section className="mt-4 rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Walking score</h2>
            <p className="text-sm text-muted-foreground">Each point is a scored walk.</p>
          </div>
          <div className="flex rounded-full bg-[#f3f6f2] p-1" role="tablist" aria-label="Score range">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={range === item.id}
                onClick={() => {
                  setRange(item.id)
                  setActive(null)
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground",
                  range === item.id && "bg-white text-ink shadow-sm",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {points.length === 0 ? (
          <p className="mt-10 mb-6 text-sm text-muted-foreground">No scored walks in this window.</p>
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

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <MetricCard
          label="Pace"
          value={latest?.pace ?? 0}
          best={bestPace}
          note="Cadence from the trackpad. Rushing the last third is the usual leak."
        />
        <MetricCard
          label="Symmetry"
          value={latest?.symmetry ?? 0}
          best={bestSymmetry}
          note="Left and right sharing the work. A longer step on one side shows up here."
        />
      </section>

      <section className="mt-4 rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)] sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Weekly minutes</h2>
            <p className="text-sm text-muted-foreground">
              {derived.weekMinutes} of {state.weeklyGoalMin} minutes. Last week was {derived.lastWeekMinutes}.
            </p>
          </div>
          <Link href="/activity" className="text-sm font-semibold text-forest">
            Review sessions
          </Link>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-sage">
          <div className="h-full rounded-full bg-forest" style={{ width: `${goalPct}%` }} />
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  )
}

function MetricCard({ label, value, best, note }: { label: string; value: number; best: number; note: string }) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)]">
      <div className="flex items-end justify-between">
        <h3 className="font-semibold text-ink">{label}</h3>
        <p className="text-2xl font-semibold tabular-nums text-ink">{value || "—"}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sage">
        <div className="h-full rounded-full bg-forest" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Best {best || "—"}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
    </article>
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
  const width = 720
  const height = 240
  const padX = 28
  const padY = 24
  const min = 60
  const max = 100
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index * (width - padX * 2)) / (points.length - 1)
    const y = padY + (1 - (point.score - min) / (max - min)) * (height - padY * 2)
    return { ...point, x, y }
  })
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const area = `${line} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`
  const current = active !== null ? coords[active] : coords[coords.length - 1]

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full"
        role="img"
        aria-label="Walking scores over time"
        onMouseLeave={() => onActive(null)}
      >
        {[70, 80, 90].map((mark) => {
          const y = padY + (1 - (mark - min) / (max - min)) * (height - padY * 2)
          return (
            <g key={mark}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e5eee8" />
              <text x={0} y={y + 4} className="fill-[#7d8f84]" fontSize="11">
                {mark}
              </text>
            </g>
          )
        })}
        <path d={area} fill="#14684a" opacity="0.12" />
        <path d={line} fill="none" stroke="#14684a" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={active === index ? 6 : 4}
              fill={active === index ? "#e8893c" : "#14684a"}
            />
            <circle
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
          </g>
        ))}
      </svg>
      {current ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-ink">{current.score}</span> on {current.name} · {current.label}
        </p>
      ) : null}
    </div>
  )
}
