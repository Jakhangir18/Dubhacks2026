"use client"

import Link from "next/link"
import { useState } from "react"
import { Camera, Check, Lock, Projector, Touchpad } from "lucide-react"
import { GoalBanner } from "@/components/goal-banner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatLevel } from "@/lib/format"
import type { LevelStatus } from "@/lib/metrics"
import type { Level } from "@/lib/types"
import { useStride } from "@/lib/store"
import { cn } from "cn"

type OpenLevel = Level & { status: LevelStatus; best: number | null }

const SETUP = [
  {
    icon: Camera,
    title: "Camera",
    body: "Keeps the walk in frame. Pace and left-right balance are scored from the trackpad.",
  },
  {
    icon: Touchpad,
    title: "Trackpad",
    body: "The floor you walk on. It times each step and feels the left-right weight shift that becomes symmetry.",
  },
  {
    icon: Projector,
    title: "Projection",
    body: "Casts the same lawn onto the trackpad. Every goal is that plant walk, scored for a different part of recovery.",
  },
]

export function PlayView() {
  const { derived, setKitOpen } = useStride()
  const [open, setOpen] = useState<OpenLevel | null>(null)

  return (
    <div>
      <PageHeader
        eyebrow={`LEVEL ${formatLevel(derived.prescribed.id)} ON YOUR PLAN`}
        title="Play & practice"
        subtitle="Ten recovery goals, in order. The walk is always stomping plants. An 80 on the current goal opens the next one."
      />

      <section className="grid gap-3 md:grid-cols-3">
        {SETUP.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => setKitOpen(true)}
              className="rounded-[24px] border border-black/5 bg-card p-5 text-left shadow-[0_8px_24px_rgba(23,48,38,0.04)] transition hover:border-forest/20 dark:border-border"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-mint text-forest dark:bg-[#234233] dark:text-[#8ed4b0]">
                <Icon className="size-4" />
              </span>
              <h2 className="mt-4 font-semibold text-card-foreground">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </button>
          )
        })}
      </section>

      <ol className="mt-8 grid gap-4 lg:grid-cols-2">
        {derived.levels.map((level) => (
            <li key={level.id}>
              <button
                type="button"
                onClick={() => setOpen(level)}
                className={cn(
                  "relative h-[168px] w-full overflow-hidden rounded-[22px] border bg-white text-left shadow-[0_8px_24px_rgba(23,48,38,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(23,48,38,0.08)]",
                  level.status === "current" && "border-orange shadow-md",
                  level.status !== "current" && "border-black/8",
                )}
              >
                <GoalBanner levelId={level.id} locked={level.status === "locked"} className="absolute inset-0">
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-[#5c6f63]">
                    {level.status === "current" ? "CONTINUE" : `LEVEL ${formatLevel(level.id)}`}
                  </span>
                  <span className="mt-1 text-[1.05rem] font-semibold leading-tight text-[#173026]">{level.name}</span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[#5c6f63]">
                    {level.status === "done" ? <Check className="size-3.5 text-forest" /> : null}
                    {level.status === "locked" ? <Lock className="size-3.5" /> : null}
                    {level.best !== null ? `Best ${level.best}` : level.status === "locked" ? "Locked" : `${level.minutes} min`}
                  </span>
                </GoalBanner>
              </button>
            </li>
        ))}
      </ol>

      <Sheet open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          {open ? (
            <>
              <GoalBanner levelId={open.id} className="mx-4 mt-4 h-40 rounded-[22px]">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#5c6f63]">
                  LEVEL {formatLevel(open.id)}
                </p>
                <p className="mt-1 text-lg font-semibold leading-tight text-[#173026]">{open.name}</p>
              </GoalBanner>
              <SheetHeader className="pr-8">
                <SheetTitle>
                  Level {formatLevel(open.id)} · {open.name}
                </SheetTitle>
                <SheetDescription>{open.setting}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <p className="text-sm leading-6 text-foreground">{open.detail}</p>
                <ul className="grid gap-2">
                  {open.focus.map((item, index) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="grid size-6 place-items-center rounded-full bg-mint text-xs font-semibold text-forest dark:bg-[#234233] dark:text-[#8ed4b0]">
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Clinic session {open.minutes} minutes.
                  {open.best !== null ? ` Best walking score ${open.best}.` : " No score yet."}
                </p>
                {open.status === "locked" ? (
                  <p className="rounded-2xl bg-peach px-4 py-3 text-sm leading-6 text-[#6d533c] dark:bg-[#3a2c22] dark:text-[#e7d3c4]">
                    Score 80 on Level {formatLevel(open.id - 1)} while it is the goal on your plan. That opens this one.
                  </p>
                ) : (
                  <Button
                    render={<Link href={`/play/session?level=${open.id}`} />}
                    className="h-11 rounded-full bg-orange text-white hover:bg-[#d9772b]"
                    onClick={() => setOpen(null)}
                  >
                    {open.status === "current" ? "Start this goal" : "Practice this goal"}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
