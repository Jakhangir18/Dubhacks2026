"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import type { Segment, TimelinePoint } from "@/lib/game"
import { clock } from "@/lib/walks"

const ACT_FILL: Record<string, string> = {
  walk: "rgba(45,226,196,0.10)",
  garden: "rgba(156,255,90,0.12)",
  storm: "rgba(164,107,255,0.14)",
  rest: "rgba(255,178,30,0.12)",
}
const ACT_NAME: Record<string, string> = { walk: "walk", garden: "flowers", storm: "seeds", rest: "rest", home: "home" }
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Cadence through the walk (the game samples it every 15 s), with the acts as bands and the evenness as a thin
 * teal line on its own 0-100 scale. */
export function TimelineChart({ points, segments, seconds }: { points: TimelinePoint[]; segments: Segment[]; seconds: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const height = 220
  const padLeft = 36
  const padRight = 14
  const padTop = 22
  const padBottom = 28
  const end = Math.max(seconds, ...points.map((point) => point.t), ...segments.map((segment) => segment.endS ?? 0), 30)
  const cadences = points.map((point) => point.cadence ?? 0)
  const top = Math.max(140, Math.ceil(Math.max(...cadences, 0) / 20) * 20)
  const toX = (t: number) => padLeft + (t / end) * (width - padLeft - padRight)
  const toY = (value: number) => padTop + (1 - Math.min(top, Math.max(0, value)) / top) * (height - padTop - padBottom)
  const toYPct = (value: number) => padTop + (1 - Math.min(100, Math.max(0, value)) / 100) * (height - padTop - padBottom)
  const coords = points.map((point) => ({ ...point, x: toX(point.t), y: toY(point.cadence ?? 0) }))
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const even = coords.filter((point) => point.evenPct !== null)
  const evenLine = even.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${toYPct(point.evenPct as number)}`).join(" ")
  const baseline = height - padBottom
  const marks = [top / 4, top / 2, (3 * top) / 4, top].map((value) => Math.round(value))
  const current = active !== null ? coords[active] : null

  return (
    <div className="mt-4">
      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border-[2.5px] border-[#1b2f27] bg-[#070b10]">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-[220px] w-full" role="img" aria-label="Cadence through the walk" onMouseLeave={() => setActive(null)}>
          {segments.map((segment, index) => {
            const x1 = toX(segment.startS)
            const x2 = toX(segment.endS ?? end)
            return (
              <g key={`${segment.act}-${index}`}>
                <rect x={x1} y={padTop} width={Math.max(0, x2 - x1)} height={baseline - padTop} fill={ACT_FILL[segment.act] ?? "transparent"} />
                {x2 - x1 > 34 ? (
                  <text x={x1 + 4} y={padTop + 12} fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="700">
                    {(ACT_NAME[segment.act] ?? segment.act).toUpperCase()}
                    {segment.act !== "walk" && segment.act !== "rest" ? ` ${segment.round}` : ""}
                  </text>
                ) : null}
              </g>
            )
          })}
          {marks.map((mark) => (
            <g key={mark}>
              <line x1={padLeft} x2={width - padRight} y1={toY(mark)} y2={toY(mark)} stroke="#2c4639" strokeDasharray="4 6" />
              <text x={6} y={toY(mark) + 4} fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600">
                {mark}
              </text>
            </g>
          ))}
          <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="#2c4639" strokeWidth="1.5" />
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <text key={fraction} x={toX(end * fraction)} y={height - 9} fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600" textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}>
              {clock(end * fraction)}
            </text>
          ))}
          {even.length > 1 ? (
            <motion.path d={evenLine} fill="none" stroke="#2de2c4" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.3 }} />
          ) : null}
          {coords.length > 1 ? (
            <>
              <motion.path d={line} fill="none" stroke="#ffb21e" strokeOpacity="0.25" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE_OUT }} />
              <motion.path d={line} fill="none" stroke="#ffb21e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE_OUT }} />
            </>
          ) : null}
          {coords.map((point, index) => (
            <g key={`${point.t}-${index}`}>
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={active === index ? 7 : 5}
                fill={active === index ? "#ffd76a" : "#0b1a14"}
                stroke="#ffb21e"
                strokeWidth={2.5}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 14, delay: 0.2 + index * 0.05 }}
              />
              <circle cx={point.x} cy={point.y} r="14" fill="transparent" className="cursor-pointer" onMouseEnter={() => setActive(index)} onClick={() => setActive(index)}>
                <title>{`${clock(point.t)}: ${point.cadence ?? "–"} steps/min, ${point.evenPct ?? "–"}% even, ${ACT_NAME[point.act] ?? point.act}`}</title>
              </circle>
            </g>
          ))}
        </svg>
        {current ? (
          <div
            className="font-display pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border-2 border-[#0b1a14] bg-[#ffb21e] px-2 py-0.5 text-sm leading-tight text-[#0b1a14] tabular-nums shadow-[3px_3px_0_#a8690b]"
            style={{ left: Math.min(Math.max(current.x, 60), width - 60), top: current.y - 10 }}
            aria-hidden="true"
          >
            {clock(current.t)} · {current.cadence ?? "–"}/min{current.evenPct !== null ? ` · ${current.evenPct}% even` : ""}
          </div>
        ) : null}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-5 rounded-full bg-[#ffb21e]" /> cadence, steps a minute</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-[#2de2c4]" /> even left / right, %</span>
        <span>bands: the acts of the walk</span>
      </p>
    </div>
  )
}
