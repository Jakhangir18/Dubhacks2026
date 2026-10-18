"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Camera, Check, Lock, Projector, Touchpad } from "lucide-react"
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
import { LEVEL_IMAGE_ALT, LEVEL_IMAGES } from "@/lib/levels"
import type { LevelStatus } from "@/lib/metrics"
import type { Level } from "@/lib/types"
import { useStride } from "@/lib/store"
import { cn } from "cn"

type OpenLevel = Level & { status: LevelStatus; best: number | null }

const SETUP = [
  {
    icon: Camera,
    title: "Camera",
    body: "Watches trunk lean, shoulder height, and stride length so the posture cue is measured, not guessed.",
  },
  {
    icon: Touchpad,
    title: "Trackpad",
    body: "The floor you walk on. It times each step and feels the left-right weight shift that becomes symmetry.",
  },
  {
    icon: Projector,
    title: "Projection",
    body: "Casts the stage onto the trackpad. The path, the stones, and the wave are under your feet.",
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
        subtitle="Ten stages, in order. An 80 on the current stage opens the next one. Earlier stages stay open when you want the cue again."
      />

      <section className="grid gap-3 md:grid-cols-3">
        {SETUP.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => setKitOpen(true)}
              className="rounded-[24px] border border-black/5 bg-white p-5 text-left shadow-[0_8px_24px_rgba(23,48,38,0.04)] transition hover:border-forest/20"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-mint text-forest">
                <Icon className="size-4" />
              </span>
              <h2 className="mt-4 font-semibold text-ink">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </button>
          )
        })}
      </section>

      <section className="relative mx-auto mt-8 max-w-xl rounded-[28px] bg-white px-4 py-8 shadow-[0_8px_24px_rgba(23,48,38,0.04)] sm:px-8">
        <div className="absolute bottom-10 left-1/2 top-10 w-px -translate-x-1/2 bg-sage" aria-hidden="true" />
        <ol className="relative grid gap-3">
          {derived.levels.map((level, index) => {
            const side = index % 2 === 0 ? "left" : "right"
            return (
              <li key={level.id} className={cn("flex", side === "right" && "justify-end")}>
                <button
                  type="button"
                  onClick={() => setOpen(level)}
                  className={cn(
                    "flex w-[min(100%,280px)] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition sm:w-[46%]",
                    side === "right" && "flex-row-reverse text-right",
                    level.status === "current" && "border-orange bg-white shadow-md",
                    level.status === "done" && "border-transparent bg-[#f7faf6] hover:border-sage",
                    level.status === "locked" && "border-transparent bg-[#f7faf6]/70 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold",
                      level.status === "current" && "step-pulse bg-orange text-white",
                      level.status === "done" && "bg-forest text-white",
                      level.status === "locked" && "bg-sage text-[#6d7f74]",
                    )}
                  >
                    {level.status === "done" ? <Check className="size-4" /> : level.status === "locked" ? <Lock className="size-4" /> : level.id}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
                      {level.status === "current" ? "CONTINUE" : `LEVEL ${formatLevel(level.id)}`}
                    </span>
                    <span className="block truncate font-semibold text-ink">{level.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {level.best !== null ? `Best ${level.best}` : level.status === "locked" ? "Locked" : `${level.minutes} min`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <Sheet open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          {open ? (
            <>
              <div className="relative mx-4 mt-4 h-44 overflow-hidden rounded-2xl">
                <Image
                  src={LEVEL_IMAGES[open.image]}
                  alt={LEVEL_IMAGE_ALT[open.image]}
                  fill
                  sizes="400px"
                  className="object-cover"
                />
              </div>
              <SheetHeader className="pr-8">
                <SheetTitle>
                  Level {formatLevel(open.id)} · {open.name}
                </SheetTitle>
                <SheetDescription>{open.setting}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-6">
                <p className="text-sm leading-6 text-ink">{open.detail}</p>
                <ul className="grid gap-2">
                  {open.focus.map((item, index) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-[#2c4036]">
                      <span className="grid size-6 place-items-center rounded-full bg-mint text-xs font-semibold text-forest">
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
                  <p className="rounded-2xl bg-peach px-4 py-3 text-sm leading-6 text-[#6d533c]">
                    Score 80 on Level {formatLevel(open.id - 1)} while it is the stage on your plan. That opens this one.
                  </p>
                ) : (
                  <Button
                    render={<Link href={`/play/session?level=${open.id}`} />}
                    className="h-11 rounded-full bg-orange text-white hover:bg-[#d9772b]"
                    onClick={() => setOpen(null)}
                  >
                    {open.status === "current" ? "Start this stage" : "Practice this stage"}
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
