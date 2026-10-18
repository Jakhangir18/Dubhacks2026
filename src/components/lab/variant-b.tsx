"use client"

import Link from "next/link"
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import { Moon, Play } from "lucide-react"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Particles } from "@/components/ui/particles"
import { ShineBorder } from "@/components/ui/shine-border"
import { formatLevel, formatWhen } from "@/lib/format"
import { LEVEL_MARKS } from "@/lib/levels"
import { useStride } from "@/lib/store"
import { Bob, Magnetic, NAV, Parallax, PopTitle, SpringBars, VariantSwitch, fredoka, lilita } from "@/components/lab/shared"
import { cn } from "cn"

const OUTLINE = "[text-shadow:0_3px_0_#0b1a14,2px_0_0_#0b1a14,-2px_0_0_#0b1a14,0_-2px_0_#0b1a14,0_6px_14px_rgba(0,0,0,0.5)]"

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-[22px] border-[3px] border-[#1d3a2c] bg-[#0d171c] shadow-[0_6px_0_#050809]", className)}>{children}</div>
  )
}

/** Dark panel with a soft spotlight that follows the pointer. */
function GlowPanel({ children, className, color }: { children: React.ReactNode; className?: string; color: string }) {
  const x = useMotionValue(-300)
  const y = useMotionValue(-300)
  const background = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, ${color}, transparent 70%)`
  return (
    <div
      className={cn("group relative overflow-hidden rounded-[22px] border-[3px] border-[#1d3a2c] bg-[#0d171c] shadow-[0_6px_0_#050809]", className)}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        x.set(event.clientX - rect.left)
        y.set(event.clientY - rect.top)
      }}
      onPointerLeave={() => {
        x.set(-300)
        y.set(-300)
      }}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ background }} />
      <div className="relative">{children}</div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[230px] shrink-0 flex-col border-r border-white/5 bg-[#0a1116]/80 px-4 py-5 backdrop-blur lg:flex">
      <div className="flex items-center gap-2">
        <Bob src="/art/gus-portrait.png" className="size-10" />
        <span className={cn(lilita.className, OUTLINE, "text-[22px] leading-[0.9] text-[#ffd76a]")}>
          ZOMBIE
          <br />
          WALK HOME
        </span>
      </div>
      <nav className="mt-8 grid gap-1.5">
        {NAV.map((item, index) => {
          const Icon = item.icon
          const active = index === 0
          return (
            <span
              key={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold",
                active ? "text-[#070b10]" : "text-white/70",
              )}
            >
              {active ? <motion.span layoutId="b-nav" className="absolute inset-0 rounded-2xl bg-[#9cff5a] shadow-[0_4px_0_#4f8f22]" /> : null}
              <Icon className="relative size-4" />
              <span className="relative">{item.label}</span>
            </span>
          )
        })}
      </nav>
      <Panel className="mt-auto p-3">
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#2de2ff]">MOVEMENT KIT</p>
        <p className="mt-1 text-xs text-white/70">Camera · projector · pad</p>
        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-1.5 flex-1 rounded-full bg-[#9cff5a]"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: dot * 0.25 }}
            />
          ))}
        </div>
      </Panel>
    </aside>
  )
}

/** Gus walks along the progress track toward his cottage, like the in-game top bar. */
function HomeTrack({ progress }: { progress: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="relative mt-6 h-12">
      <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-[#0b1a14] bg-[#14242a]">
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,#4f8f22,#9cff5a_80%,#ffb21e)]"
          initial={reduce ? false : { width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
        />
      </div>
      <motion.img
        src="/art/gus-step.png"
        alt=""
        className="absolute top-1/2 h-14 -translate-x-1/2 -translate-y-[70%]"
        initial={reduce ? false : { left: "0%" }}
        animate={{ left: `${progress}%`, rotate: reduce ? 0 : [0, -6, 6, 0] }}
        transition={{ left: { duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.6 }, rotate: { duration: 0.5, repeat: Infinity } }}
      />
      <img src="/art/house.png" alt="" className="absolute -top-3 right-0 h-14" />
    </div>
  )
}

export function VariantB() {
  const { state, derived } = useStride()
  const level = derived.prescribed
  const maya = [...state.messages].reverse().find((message) => message.from === "maya")
  const done = derived.levels.filter((item) => item.status === "done").length
  const progress = Math.round(((done + 0.5) / Math.max(derived.levels.length, 1)) * 100)

  return (
    <div className={cn(fredoka.className, "relative min-h-screen bg-[#070b10] text-white")}>
      <Particles className="pointer-events-none fixed inset-0" quantity={70} staticity={60} size={0.6} color="#ffffff" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(164,107,255,0.18),transparent_45%),radial-gradient(ellipse_at_10%_100%,rgba(45,226,196,0.12),transparent_50%)]" />
      <div className="relative mx-auto flex max-w-[1440px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <BlurFade delay={0.05}>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#2de2c4]">NIGHT {derived.streak + 1} · GRANDMA ROSA&apos;S GARDEN</p>
            <h1 className={cn(lilita.className, "mt-1 text-4xl text-white sm:text-5xl")}>Evening, Jordan!</h1>
          </BlurFade>

          <BlurFade delay={0.15}>
            <section className="relative mt-5 overflow-hidden rounded-[30px] border-[3px] border-[#1d3a2c] shadow-[0_8px_0_#050809]">
              <Parallax className="h-[360px] sm:h-[420px]" strength={22}>
                <img src="/images/hero-night-b.webp" alt="" className="size-full object-cover object-[70%_40%]" draggable={false} />
              </Parallax>
              <Particles className="pointer-events-none absolute inset-0" quantity={36} staticity={30} size={1.1} color="#9cff5a" />
              <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6 lg:right-auto lg:w-[56%]">
                <Panel className="bg-[#0d171c]/92 px-6 py-5 backdrop-blur">
                  <ShineBorder shineColor={["#9cff5a", "#2de2c4", "#ffb21e"]} borderWidth={2} duration={10} />
                  <p className={cn(lilita.className, "text-lg tracking-wide text-white")}>LEVEL {formatLevel(level.id)}</p>
                  <h2 className={cn(lilita.className, OUTLINE, "text-5xl leading-[0.95] text-[#ffd76a] sm:text-6xl")}>
                    <PopTitle text={level.name.toUpperCase()} delay={0.4} />
                  </h2>
                  <p className={cn(lilita.className, "mt-1 tracking-wide text-white/90")}>{level.chip.toUpperCase()} · {level.minutes} MIN</p>
                  <HomeTrack progress={progress} />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Magnetic>
                      <Link
                        href={`/play/session?level=${level.id}`}
                        className={cn(
                          lilita.className,
                          "inline-flex h-12 items-center gap-2 rounded-2xl border-[3px] border-[#0b1a14] bg-[#9cff5a] px-6 text-xl tracking-wide text-[#0b1a14] shadow-[0_6px_0_#3d7a19] transition active:translate-y-1 active:shadow-[0_2px_0_#3d7a19]",
                        )}
                      >
                        <Play className="size-5 fill-current" /> PLAY
                      </Link>
                    </Magnetic>
                    <span className="text-sm text-white/70">{done} of {derived.levels.length} gardens cleared</span>
                  </div>
                </Panel>
              </div>
            </section>
          </BlurFade>

          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            <BlurFade delay={0.3}>
              <GlowPanel className="h-full p-5" color="#9cff5a33">
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2ff]">WALKING SCORE</p>
                <p className={cn(lilita.className, OUTLINE, "mt-1 text-6xl text-[#9cff5a] tabular-nums")}>
                  <NumberTicker value={derived.walkingScore} delay={0.4} />
                </p>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 10 }, (_, index) => (
                    <motion.span
                      key={index}
                      className={cn("h-3 flex-1 rounded-sm border-2 border-[#0b1a14]", index < Math.round(derived.walkingScore / 10) ? "bg-[#2de2ff]" : "bg-[#14242a]")}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.5 + index * 0.05 }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/60">{derived.scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(derived.scoreDelta)}% this week</p>
              </GlowPanel>
            </BlurFade>
            <BlurFade delay={0.4}>
              <GlowPanel className="h-full p-5" color="#ffb21e33">
                <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">MINUTES THIS WEEK</p>
                <p className={cn(lilita.className, OUTLINE, "mt-1 text-6xl text-[#ffd76a] tabular-nums")}>
                  <NumberTicker value={derived.weekMinutes} delay={0.5} />
                </p>
                <SpringBars days={derived.week} barClass="bg-[#2de2ff]/35" hotClass="bg-[#ffb21e]" labelClass="text-white/70" />
              </GlowPanel>
            </BlurFade>
            <BlurFade delay={0.5}>
              <Panel className="h-full p-5">
                <div className="flex items-center gap-3">
                  <Bob src="/art/flower-rose.png" className="size-12" />
                  <div>
                    <p className={cn(lilita.className, "text-xl text-[#ff3d8b]")}>MAYA SAYS</p>
                    <p className="text-xs text-white/60">AI therapist</p>
                  </div>
                </div>
                <motion.p
                  className="relative mt-4 rounded-2xl border-[3px] border-[#0b1a14] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#0b1a14]"
                  initial={{ scale: 0.8, opacity: 0, rotate: -2 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.9 }}
                >
                  {maya?.text ?? "Finish a walk and I will have a note waiting."}
                </motion.p>
              </Panel>
            </BlurFade>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_0.9fr]">
            <BlurFade delay={0.55}>
              <Panel className="p-5">
                <p className={cn(lilita.className, "text-2xl")}>RECENT WALKS</p>
                <ul className="mt-3 grid gap-2">
                  {derived.recent.slice(0, 3).map((session, index) => (
                    <motion.li
                      key={session.id}
                      className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.08 }}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(156,255,90,0.08)" }}
                    >
                      <img src={LEVEL_MARKS[session.levelId] ?? "/art/flower-marigold.png"} alt="" className="size-10 object-contain transition group-hover:-rotate-12" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{session.levelName}</span>
                        <span className="block text-xs text-white/60">{formatWhen(session.playedAt, derived.now)}</span>
                      </span>
                      <span className={cn(lilita.className, "text-2xl text-[#9cff5a] tabular-nums")}>{session.walkingScore}</span>
                    </motion.li>
                  ))}
                </ul>
              </Panel>
            </BlurFade>
            <BlurFade delay={0.65}>
              <Panel className="h-full p-5">
                <p className={cn(lilita.className, "text-2xl")}>NIGHT STREAK</p>
                <p className={cn(lilita.className, OUTLINE, "text-6xl text-[#ffd76a]")}>
                  <NumberTicker value={derived.streak} delay={0.8} />
                </p>
                <div className="mt-3 flex gap-1.5">
                  {derived.week.map((day, index) => (
                    <motion.span
                      key={day.key}
                      className={cn(
                        "grid size-9 flex-1 place-items-center rounded-xl border-2 border-[#0b1a14] text-xs font-bold",
                        day.hasSession ? "bg-[#ffd76a] text-[#0b1a14]" : "bg-[#14242a] text-white/50",
                      )}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.9 + index * 0.06 }}
                    >
                      {day.hasSession ? <Moon className="size-4 fill-current" /> : day.label}
                    </motion.span>
                  ))}
                </div>
              </Panel>
            </BlurFade>
          </section>
        </main>
      </div>
      <VariantSwitch dark />
    </div>
  )
}
