"use client"

import Link from "next/link"
import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Camera, Check, Lock, Play, Projector, Touchpad } from "lucide-react"
import { Bob, Magnetic } from "@/components/motion"
import { PageHeader } from "@/components/page-header"
import { BlurFade } from "@/components/ui/blur-fade"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatLevel } from "@/lib/format"
import { LEVEL_MARKS } from "@/lib/levels"
import type { LevelStatus } from "@/lib/metrics"
import { GAME_BUTTON, ZOMBIE, sticker } from "@/lib/sticker"
import type { Level } from "@/lib/types"
import { useStride } from "@/lib/store"
import { cn } from "cn"

type OpenLevel = Level & { status: LevelStatus; best: number | null }

const SETUP = [
  { icon: Camera, title: "Camera", body: "Watches both feet and keeps the walk in frame.", tone: "teal" as const },
  { icon: Touchpad, title: "Floor pad", body: "Times each step and feels the left-right shift.", tone: "violet" as const },
  { icon: Projector, title: "Projector", body: "Paints the same night lawn under your feet.", tone: "amber" as const },
]

/** Map canvas in SVG units; nodes zigzag from the garden gate (bottom) up to the cottage (top). */
const MAP_W = 400
const MAP_H = 1080
const NODES = [
  { x: 110, y: 980 },
  { x: 290, y: 900 },
  { x: 120, y: 810 },
  { x: 285, y: 720 },
  { x: 115, y: 630 },
  { x: 290, y: 540 },
  { x: 125, y: 450 },
  { x: 285, y: 360 },
  { x: 120, y: 270 },
  { x: 270, y: 185 },
]

/** Smooth S-curve through the given points: each hop bends through its vertical midpoint. */
function trail(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ""
  let d = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    const mid = (from.y + to.y) / 2
    d += ` C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`
  }
  return d
}

const pct = (value: number, of: number) => `${(value / of) * 100}%`

function JourneyMap({ levels, onOpen }: { levels: OpenLevel[]; onOpen: (level: OpenLevel) => void }) {
  const reduce = useReducedMotion()
  const nodes = levels.map((level, index) => ({ level, ...NODES[index % NODES.length] }))
  const currentIndex = Math.max(
    0,
    nodes.findIndex((node) => node.level.status === "current"),
  )
  const walked = trail(nodes.slice(0, currentIndex + 1))
  const from = nodes[Math.max(0, currentIndex - 1)]
  const here = nodes[currentIndex]

  return (
    <div className={sticker("lime", "relative overflow-hidden p-0")}>
      {/* Sky warms toward sunrise at the top: the lore is getting home before the sun is up. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#ff9a5a_0%,#a46bff_14%,#1b1440_30%,#0b1a14_62%,#0e2a17_100%)]" />
      <div className="absolute inset-0 bg-[repeating-conic-gradient(rgba(156,255,90,0.06)_0_25%,transparent_0_50%)] [background-size:56px_56px] [mask-image:linear-gradient(180deg,transparent_22%,black_45%)]" />
      <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
        <Bob src="/art/moon.png" className="absolute left-[6%] top-[4%] w-[13%] max-w-24" />
        <Bob src="/art/tree-teal.png" className="absolute left-[3%] top-[34%] w-[16%] max-w-32" delay={0.4} />
        <Bob src="/art/flower-marigold.png" className="absolute left-[8%] top-[58%] w-[12%] max-w-24" delay={0.8} />
        <Bob src="/art/pod.png" className="absolute left-[5%] top-[80%] w-[10%] max-w-20" delay={1.2} />
        <Bob src="/art/tree-lime.png" className="absolute right-[4%] top-[22%] w-[15%] max-w-32" delay={0.2} />
        <Bob src="/art/flower-rose.png" className="absolute right-[7%] top-[48%] w-[12%] max-w-24" delay={0.6} />
        <Bob src="/art/flower-bell.png" className="absolute right-[5%] top-[72%] w-[11%] max-w-24" delay={1} />
      </div>
      <div className="relative mx-auto w-full max-w-[460px]" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 size-full" aria-hidden="true">
          <path d={trail(nodes)} fill="none" stroke="#2c4639" strokeWidth={22} strokeLinecap="round" />
          <path d={trail(nodes)} fill="none" stroke="#14242a" strokeWidth={14} strokeLinecap="round" strokeDasharray="2 20" />
          <motion.path
            d={walked}
            fill="none"
            stroke="#9cff5a"
            strokeWidth={10}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(156,255,90,0.6))" }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : 1.8, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.3 }}
          />
        </svg>

        {/* Cottage and gate. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/house.png" alt="" className="absolute left-1/2 top-[1%] w-[34%] -translate-x-1/2 drop-shadow-[0_0_30px_rgba(255,215,106,0.55)]" />
        <span className="font-display text-outline absolute left-1/2 top-[11.5%] -translate-x-1/2 whitespace-nowrap text-lg tracking-wide text-[#ffd76a]">
          HOME
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/fence.png" alt="" className="absolute bottom-[0.5%] left-[4%] w-[30%] opacity-90" />

        {nodes.map((node, index) => {
          const { level } = node
          const current = level.status === "current"
          const locked = level.status === "locked"
          return (
            <motion.button
              key={level.id}
              type="button"
              onClick={() => onOpen(level)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
              style={{ left: pct(node.x, MAP_W), top: pct(node.y, MAP_H) }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.25 + index * 0.07 }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.94 }}
              aria-label={`Level ${formatLevel(level.id)}, ${level.name}, ${current ? "tonight's goal" : locked ? "locked" : `best ${level.best ?? "none"}`}`}
            >
              {current ? (
                <motion.span
                  className="absolute inset-[-14px] rounded-full border-[3px] border-[#ffb21e]"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.9, 0.2, 0.9] }}
                  transition={{ duration: 1.8, repeat: reduce ? 0 : Infinity }}
                />
              ) : null}
              <span
                className={cn(
                  "relative grid place-items-center rounded-full border-[3px] shadow-[0_5px_0_#050809] transition group-focus-visible:ring-4 group-focus-visible:ring-[#2de2ff]",
                  current && "size-[74px] border-[#0b1a14] bg-[#ffb21e]",
                  level.status === "done" && "size-16 border-[#0b1a14] bg-[#9cff5a]",
                  locked && "size-14 border-[#2c4639] bg-[#0d171c]",
                )}
              >
                {locked ? (
                  <Lock className="size-5 text-white/40" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={LEVEL_MARKS[level.id] ?? "/art/flower-marigold.png"} alt="" className={cn("object-contain", current ? "size-12" : "size-10")} />
                )}
                {level.status === "done" ? (
                  <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border-2 border-[#0b1a14] bg-white text-[#0b1a14]">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "font-display absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-sm tracking-wide",
                  node.x < MAP_W / 2 ? "left-[calc(100%+10px)]" : "right-[calc(100%+10px)] text-right",
                  current ? "text-[#ffd76a]" : locked ? "text-white/35" : "text-white/85",
                )}
              >
                {formatLevel(level.id)} · {level.name}
                {level.best !== null ? <span className="block font-sans text-[11px] font-semibold text-[#9cff5a]">best {level.best}</span> : null}
              </span>
            </motion.button>
          )
        })}

        {/* The zombie shuffles from the last cleared garden to tonight's goal. */}
        { }
        <motion.img
          src={ZOMBIE.walk}
          alt=""
          className="pointer-events-none absolute w-[17%] -translate-x-1/2 -translate-y-[88%] drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]"
          initial={{ left: pct(from.x, MAP_W), top: pct(from.y, MAP_H) }}
          animate={{
            left: pct(here.x + (here.x < MAP_W / 2 ? -46 : 46), MAP_W),
            top: pct(here.y, MAP_H),
            rotate: [0, -6, 6, 0],
          }}
          transition={{ left: { duration: reduce ? 0 : 1.6, delay: reduce ? 0 : 0.9 }, top: { duration: reduce ? 0 : 1.6, delay: reduce ? 0 : 0.9 }, rotate: { duration: 0.6, repeat: Infinity } }}
        />
      </div>
    </div>
  )
}

export function PlayView() {
  const { derived, setKitOpen } = useStride()
  const [open, setOpen] = useState<OpenLevel | null>(null)
  const current = derived.levels.find((level) => level.status === "current") ?? derived.levels[0]
  const done = derived.levels.filter((level) => level.status === "done").length

  return (
    <div>
      <PageHeader
        eyebrow={`LEVEL ${formatLevel(derived.prescribed.id)} ON YOUR PLAN · ${done} OF ${derived.levels.length} GARDENS CLEARED`}
        title="Walk home"
        subtitle="Ten gardens between the gate and Gus's bed. Score 80 on tonight's garden and the next one opens. Tap any garden to see what it practises."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <BlurFade delay={0.1}>
          <JourneyMap levels={derived.levels} onOpen={setOpen} />
        </BlurFade>

        <div className="grid gap-5 lg:sticky lg:top-6">
          <BlurFade delay={0.2}>
            <article className={sticker("amber", "p-5")}>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">
                TONIGHT · CHAPTER {formatLevel(current.id)} · {current.minutes} MIN
              </p>
              <h2 className="font-display text-outline mt-1 text-4xl leading-none tracking-wide text-[#ffd76a]">{current.name.toUpperCase()}</h2>
              <p className="mt-2 text-[15px] leading-6 text-white/75">{current.summary}</p>
              <ol className="mt-4 grid gap-2">
                {current.focus.map((item, index) => (
                  <motion.li
                    key={item}
                    className="flex items-center gap-2 text-sm text-white/90"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-[#9cff5a] text-xs font-bold text-[#0b1a14]">{index + 1}</span>
                    {item}
                  </motion.li>
                ))}
              </ol>
              <div className="mt-5 flex items-center gap-3">
                <Magnetic>
                  <Link href={`/play/session?level=${current.id}`} className={GAME_BUTTON}>
                    <Play className="size-5 fill-current" /> PLAY
                  </Link>
                </Magnetic>
                <span className="text-sm text-white/65">{current.best !== null ? `Best ${current.best}` : "No score yet"}</span>
              </div>
            </article>
          </BlurFade>

          <BlurFade delay={0.3}>
            <section className="grid gap-3">
              {SETUP.map((item) => {
                const Icon = item.icon
                return (
                  <motion.button
                    key={item.title}
                    type="button"
                    onClick={() => setKitOpen(true)}
                    whileHover={{ x: 4 }}
                    className={sticker(item.tone, "flex items-center gap-3 rounded-[20px] p-3 text-left")}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-black/30 text-white">
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{item.title}</span>
                      <span className="block text-sm text-white/65">{item.body}</span>
                    </span>
                  </motion.button>
                )
              })}
            </section>
          </BlurFade>
        </div>
      </div>

      <Sheet open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          {open ? (
            <>
              <div className={sticker(open.status === "locked" ? "ink" : "lime", "relative mx-4 mt-4 flex h-36 items-center gap-4 overflow-hidden px-5")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={LEVEL_MARKS[open.id] ?? "/art/flower-marigold.png"}
                  alt=""
                  className={cn("size-24 object-contain", open.status === "locked" && "opacity-40 grayscale")}
                />
                <div>
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#9cff5a]">LEVEL {formatLevel(open.id)}</p>
                  <p className="font-display text-outline text-3xl leading-none tracking-wide text-[#ffd76a]">{open.name.toUpperCase()}</p>
                </div>
              </div>
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
                      <span className="grid size-6 place-items-center rounded-full bg-[#9cff5a] text-xs font-bold text-[#0b1a14]">{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Floor session {open.minutes} minutes.
                  {open.best !== null ? ` Best walking score ${open.best}.` : " No score yet."}
                </p>
                {open.status === "locked" ? (
                  <p className={sticker("amber", "rounded-2xl px-4 py-3 text-sm leading-6 text-white/85 shadow-none")}>
                    Score 80 on Level {formatLevel(open.id - 1)} while it is the goal on your plan. That opens this one.
                  </p>
                ) : (
                  <Link href={`/play/session?level=${open.id}`} className={cn(GAME_BUTTON, "justify-center")} onClick={() => setOpen(null)}>
                    <Play className="size-5 fill-current" />
                    {open.status === "current" ? "START THIS GARDEN" : "PRACTISE THIS GARDEN"}
                  </Link>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
