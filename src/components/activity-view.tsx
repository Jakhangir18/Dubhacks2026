"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "motion/react"
import { ChevronDown, Play, Search } from "lucide-react"
import { GoalBanner } from "@/components/goal-banner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatLevel, formatMinutes, formatWhen } from "@/lib/format"
import { LEVELS, LEVEL_MARKS, levelById } from "@/lib/levels"
import { GAME_BUTTON, sticker } from "@/lib/sticker"
import { useStride } from "@/lib/store"
import { cn } from "cn"

const FIELD =
  "h-11 rounded-2xl border-[2.5px] border-[#2c4639] bg-[#0d171c] text-sm font-medium text-white outline-none focus-visible:border-[#9cff5a] focus-visible:ring-3 focus-visible:ring-[#9cff5a]/25 dark:bg-[#0d171c]"

export function ActivityView() {
  const params = useSearchParams()
  const requested = params.get("session")
  const { derived } = useStride()
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState("all")
  const [picked, setPicked] = useState<string | null>(null)
  const [closedRequest, setClosedRequest] = useState<string | null>(null)
  const openId = picked ?? (requested && requested !== closedRequest ? requested : null)

  const sessions = useMemo(() => {
    return derived.recent.filter((session) => {
      const matchesStage = stage === "all" || String(session.levelId) === stage
      const matchesQuery = session.levelName.toLowerCase().includes(query.trim().toLowerCase())
      return matchesStage && matchesQuery
    })
  }, [derived.recent, query, stage])

  const open = derived.recent.find((session) => session.id === openId) ?? null
  const openLevel = open ? levelById(open.levelId) : null

  return (
    <div>
      <PageHeader
        eyebrow="HISTORY"
        title="Sessions"
        subtitle="Every scored walk, from the clinic floor and from form rounds on this screen."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by goal"
            aria-label="Search sessions"
            className={cn(FIELD, "pl-10 placeholder:text-white/45")}
          />
        </div>
        <div className="relative sm:w-72">
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            aria-label="Filter by goal"
            className={cn(FIELD, "w-full appearance-none px-3.5 pr-10 [color-scheme:dark]")}
          >
            <option value="all">All goals</option>
            {LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {formatLevel(level.id)} · {level.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-[#9cff5a]" aria-hidden="true" />
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className={sticker("ink", "border-dashed px-6 py-14 text-center")}>
          <p className="font-display text-2xl tracking-wide text-[#ffd76a]">NO SESSIONS MATCH</p>
          <p className="mt-1 text-sm text-white/65">Clear the search, or finish a form round and it will land here.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-10 rounded-full border-[2.5px] border-[#2c4639] bg-transparent px-4 font-semibold text-white hover:bg-white/10 dark:bg-transparent"
            onClick={() => { setQuery(""); setStage("all") }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {sessions.map((session, index) => (
            <motion.li
              key={session.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.1 + Math.min(index, 12) * 0.04 }}
            >
              <button
                type="button"
                onClick={() => setPicked(session.id)}
                className="group flex w-full items-center gap-3 rounded-2xl border-[2.5px] border-[#1b2f27] bg-[#0d171c] px-3 py-3 text-left shadow-[4px_4px_0_#050809] outline-none hover:border-[#9cff5a]/70 hover:bg-[#12261a] focus-visible:border-[#9cff5a] sm:gap-4 sm:px-5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#12261a] ring-2 ring-[#2c4639] group-hover:ring-[#9cff5a]/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={LEVEL_MARKS[session.levelId] ?? "/art/flower-marigold.png"}
                    alt=""
                    className="size-9 object-contain transition-transform group-hover:-rotate-12 group-hover:scale-110 motion-reduce:transition-none"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{session.levelName}</span>
                  <span className="block text-sm text-white/60">
                    {formatWhen(session.playedAt, derived.now)} · {session.source === "form-round" ? "Form round · " : ""}
                    {formatMinutes(session.durationMin)}
                  </span>
                </span>
                <span className="hidden gap-2 sm:flex">
                  <span className="rounded-full bg-[#2a1f0e] px-2.5 py-1 text-xs font-semibold text-[#ffb21e]">Pace {session.pace}</span>
                  <span className="rounded-full bg-[#0e2529] px-2.5 py-1 text-xs font-semibold text-[#2de2c4]">Symmetry {session.symmetry}</span>
                </span>
                <span className="font-display text-outline w-14 shrink-0 text-right text-4xl text-[#9cff5a] tabular-nums">
                  {session.walkingScore}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      <Sheet
        open={Boolean(open)}
        onOpenChange={(next) => {
          if (next) return
          setPicked(null)
          if (requested) setClosedRequest(requested)
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          {open && openLevel ? (
            <>
              <GoalBanner levelId={openLevel.id} className="mx-4 mt-4 h-40 shrink-0 rounded-[22px] border-[2.5px] border-[#2c4639]">
                <div className={sticker("ink", "rotate-[-1.5deg] rounded-2xl px-3 py-2 shadow-[3px_3px_0_#050809]")}>
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">LEVEL {formatLevel(openLevel.id)}</p>
                  <p className="font-display mt-0.5 text-lg leading-tight tracking-wide text-[#ffd76a]">{open.levelName}</p>
                </div>
              </GoalBanner>
              <SheetHeader className="pr-8">
                <SheetTitle className="flex items-baseline gap-1">
                  <span className="font-display text-outline text-6xl leading-none text-[#9cff5a] tabular-nums">{open.walkingScore}</span>
                  <span className="text-base font-medium text-white/60">/100</span>
                </SheetTitle>
                <SheetDescription className="text-white/65">
                  {open.levelName} · {formatWhen(open.playedAt, derived.now)} · {formatMinutes(open.durationMin)}
                  {open.source === "form-round" ? " · Form round" : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <dl className="grid grid-cols-2 gap-3 text-center">
                  <Mini label="Pace" value={open.pace} labelClass="text-[#ffb21e]" className="border-[#ffb21e]/50 bg-[#2a1f0e]" />
                  <Mini label="Symmetry" value={open.symmetry} labelClass="text-[#2de2c4]" className="border-[#2de2c4]/50 bg-[#0e2529]" />
                </dl>
                <p className="text-sm text-white/65">{open.steps.toLocaleString("en-US")} steps scored</p>
                <p className="rounded-2xl rounded-tl-sm border-[2.5px] border-[#2c4639] bg-[#12261a] px-4 py-3 text-sm leading-6 text-white/85">
                  {open.feedback}
                </p>
                <Link href={`/play/session?level=${open.levelId}`} className={cn(GAME_BUTTON, "justify-center text-lg")}>
                  <Play className="size-5 fill-current" /> Practice level {formatLevel(open.levelId)}
                </Link>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Mini({ label, value, labelClass, className }: { label: string; value: number; labelClass: string; className: string }) {
  return (
    <div className={cn("rounded-2xl border-[2.5px] px-2 py-3", className)}>
      <dt className={cn("text-[11px] font-bold tracking-[0.16em] uppercase", labelClass)}>{label}</dt>
      <dd className="font-display text-outline mt-1 text-3xl text-white tabular-nums">{value}</dd>
    </div>
  )
}
