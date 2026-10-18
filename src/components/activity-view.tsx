"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { DemoTag, EmptyNote, ReviewChip } from "@/components/walk-bits"
import { useMounted } from "@/lib/game"
import { useGame } from "@/lib/game-data"
import { asset } from "@/lib/paths"
import { clockLabel, durationLabel, whenLabel } from "@/lib/walks"
import { cn } from "cn"

const FIELD =
  "h-11 rounded-2xl border-[2.5px] border-[#2c4639] bg-[#0d171c] text-sm font-medium text-white outline-none focus-visible:border-[#9cff5a] focus-visible:ring-3 focus-visible:ring-[#9cff5a]/25 dark:bg-[#0d171c]"

const FILTERS = [
  { id: "all", label: "All walks" },
  { id: "home", label: "Walks that got home" },
  { id: "reviewed", label: "Reviewed by Maya" },
  { id: "camera", label: "With the side camera" },
] as const

export function ActivityView() {
  const { walks, demo, loading, player } = useGame()
  const mounted = useMounted()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const now = new Date()

  const shown = useMemo(
    () =>
      walks.filter((walk) => {
        if (filter === "home") return walk.home
        if (filter === "reviewed") return walk.review?.status === "done"
        if (filter === "camera") return walk.kneeDeg.L !== null || walk.kneeDeg.R !== null || Boolean(walk.review)
        return true
      }),
    [walks, filter],
  )

  return (
    <div>
      <PageHeader
        eyebrow={`HISTORY · ${player.toUpperCase()}`}
        title="Sessions"
        subtitle="Every walk on the pad: the game's numbers, the side camera's measurements and Maya's review."
        extra={demo ? <DemoTag className="mt-2" /> : null}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as (typeof FILTERS)[number]["id"])}
            aria-label="Filter walks"
            className={cn(FIELD, "w-full appearance-none px-3.5 pr-10 [color-scheme:dark]")}
          >
            {FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-[#9cff5a]" aria-hidden="true" />
        </div>
        <p className="text-sm text-white/60">
          {shown.length} of {walks.length} {walks.length === 1 ? "walk" : "walks"}
        </p>
      </div>

      {loading && !walks.length ? (
        <ul className="grid gap-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="h-[76px] animate-pulse rounded-2xl border-[2.5px] border-[#1b2f27] bg-[#0d171c] motion-reduce:animate-none" />
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <EmptyNote title="NO WALKS MATCH" body={walks.length ? "Pick another filter." : "Finish a walk on the pad and it lands here with its numbers and Maya's review."} />
      ) : (
        <ul className="grid gap-3">
          {shown.map((walk, index) => {
            const inner = (
              <>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#12261a] ring-2 ring-[#2c4639] group-hover:ring-[#9cff5a]/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(walk.home ? "/art/house.png" : "/art/pod.png")}
                    alt=""
                    className="size-9 object-contain transition-transform group-hover:-rotate-12 group-hover:scale-110 motion-reduce:transition-none"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold text-white">
                      {mounted ? `${whenLabel(walk.at, now)} · ${clockLabel(walk.at)}` : "Walk"}
                    </span>
                    <ReviewChip walk={walk} className="hidden sm:inline-flex" />
                  </span>
                  <span className="block text-sm text-white/60">
                    {durationLabel(walk.seconds)} · {walk.rounds ? `${walk.rounds} ${walk.rounds === 1 ? "round" : "rounds"} · ` : ""}
                    {walk.home ? "Gus got home" : "stopped early"}
                    {walk.steps !== null ? ` · ${walk.steps} steps` : ""}
                  </span>
                </span>
                <span className="hidden gap-2 lg:flex">
                  {walk.cadence !== null ? <span className="rounded-full bg-[#2a1f0e] px-2.5 py-1 text-xs font-semibold text-[#ffb21e]">{walk.cadence} /min</span> : null}
                  {walk.evenPct !== null ? <span className="rounded-full bg-[#0e2529] px-2.5 py-1 text-xs font-semibold text-[#2de2c4]">Even {walk.evenPct}%</span> : null}
                  {walk.kneeDeg.L !== null || walk.kneeDeg.R !== null ? (
                    <span className="rounded-full bg-[#1f1630] px-2.5 py-1 text-xs font-semibold text-[#c9a8ff]">
                      Knee {walk.kneeDeg.L ?? "–"}° / {walk.kneeDeg.R ?? "–"}°
                    </span>
                  ) : null}
                </span>
                <span className="w-16 shrink-0 text-right">
                  <span className="font-display text-outline block text-3xl text-[#9cff5a] tabular-nums sm:text-4xl">{walk.flowersPct !== null ? `${walk.flowersPct}%` : "—"}</span>
                  <span className="block text-[10px] font-bold tracking-[0.12em] text-white/50">FLOWERS</span>
                </span>
              </>
            )
            const rowClass =
              "group flex w-full items-center gap-3 rounded-2xl border-[2.5px] border-[#1b2f27] bg-[#0d171c] px-3 py-3 text-left shadow-[4px_4px_0_#050809] outline-none sm:gap-4 sm:px-5"
            return (
              <motion.li
                key={walk.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={walk.openable ? { y: -3 } : undefined}
                transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.1 + Math.min(index, 12) * 0.04 }}
              >
                {walk.openable ? (
                  <Link href={`/play/session?id=${encodeURIComponent(walk.id)}`} className={cn(rowClass, "hover:border-[#9cff5a]/70 hover:bg-[#12261a] focus-visible:border-[#9cff5a]")}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cn(rowClass, "opacity-80")} title="An older walk without an id: the list shows it, the detail page cannot open it.">
                    {inner}
                  </div>
                )}
              </motion.li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
