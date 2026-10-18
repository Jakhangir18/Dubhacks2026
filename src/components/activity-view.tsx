"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
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
import { LEVELS, LEVEL_IMAGE_ALT, LEVEL_IMAGES, levelById } from "@/lib/levels"
import { useStride } from "@/lib/store"

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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by stage"
          aria-label="Search sessions"
          className="h-10 bg-white sm:max-w-xs"
        />
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          aria-label="Filter by stage"
          className="h-10 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <option value="all">All stages</option>
          {LEVELS.map((level) => (
            <option key={level.id} value={level.id}>
              {formatLevel(level.id)} · {level.name}
            </option>
          ))}
        </select>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-white px-6 py-16 text-center">
          <p className="text-lg font-semibold text-ink">No sessions match.</p>
          <p className="mt-1 text-sm text-muted-foreground">Clear the search, or finish a form round and it will land here.</p>
          <Button type="button" variant="outline" className="mt-4 h-10 rounded-full px-4" onClick={() => { setQuery(""); setStage("all") }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_8px_24px_rgba(23,48,38,0.04)]">
          {sessions.map((session) => (
            <li key={session.id} className="border-b border-border/80 last:border-b-0">
              <button
                type="button"
                onClick={() => setPicked(session.id)}
                className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-[#f7faf6] sm:px-6"
              >
                <span className="w-16 shrink-0 text-2xl font-semibold tabular-nums text-ink">{session.walkingScore}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{session.levelName}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatWhen(session.playedAt, derived.now)} · {session.source === "form-round" ? "Form round · " : ""}
                    {formatMinutes(session.durationMin)}
                  </span>
                </span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">
                  <span className="block">Pace {session.pace}</span>
                  <span className="block">Symmetry {session.symmetry}</span>
                  <span className="block">Posture {session.posture}</span>
                </span>
              </button>
            </li>
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
              <div className="relative mx-4 mt-4 h-44 overflow-hidden rounded-2xl">
                <Image
                  src={LEVEL_IMAGES[openLevel.image]}
                  alt={LEVEL_IMAGE_ALT[openLevel.image]}
                  fill
                  sizes="400px"
                  className="object-cover"
                />
              </div>
              <SheetHeader className="pr-8">
                <SheetTitle>
                  {open.walkingScore}
                  <span className="ml-1 text-base font-medium text-muted-foreground">/100</span>
                </SheetTitle>
                <SheetDescription>
                  {open.levelName} · {formatWhen(open.playedAt, derived.now)} · {formatMinutes(open.durationMin)}
                  {open.source === "form-round" ? " · Form round" : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Pace" value={open.pace} />
                  <Mini label="Symmetry" value={open.symmetry} />
                  <Mini label="Posture" value={open.posture} />
                </dl>
                <p className="text-sm text-muted-foreground">{open.steps.toLocaleString("en-US")} steps scored</p>
                <p className="rounded-2xl bg-mint px-4 py-3 text-sm leading-6 text-ink">{open.feedback}</p>
                <Button
                  render={<Link href={`/play/session?level=${open.levelId}`} />}
                  className="h-11 rounded-full"
                >
                  Practice level {formatLevel(open.levelId)}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f6faf6] px-2 py-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
