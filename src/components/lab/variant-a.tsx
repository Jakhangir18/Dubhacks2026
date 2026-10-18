"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check, ChevronRight } from "lucide-react"
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar"
import { BlurFade } from "@/components/ui/blur-fade"
import { MagicCard } from "@/components/ui/magic-card"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Particles } from "@/components/ui/particles"
import { formatHeading, formatLevel, formatMinutes, formatWhen, greeting } from "@/lib/format"
import { LEVEL_MARKS } from "@/lib/levels"
import { useStride } from "@/lib/store"
import { Bob, Magnetic, NAV, Parallax, PopTitle, SpringBars, VariantSwitch, fredoka, lilita } from "@/components/lab/shared"
import { cn } from "cn"

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col px-4 py-5 lg:flex">
      <div className="flex items-center gap-2.5">
        <Bob src="/art/gus-portrait.png" className="size-9" />
        <span className={cn(lilita.className, "text-xl leading-none text-[#14684a]")}>
          Zombie Walk <span className="text-[#e8893c]">Home</span>
        </span>
      </div>
      <nav className="mt-8 grid gap-1">
        {NAV.map((item, index) => {
          const Icon = item.icon
          const active = index === 0
          return (
            <span key={item.href} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#41564a]">
              {active ? <motion.span layoutId="a-nav" className="absolute inset-0 rounded-xl bg-[#e5f3e8]" /> : null}
              <Icon className="relative size-4" />
              <span className="relative">{item.label}</span>
            </span>
          )
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-[#dce6df] bg-white p-3 text-xs text-[#5c6e64]">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1a2b22]">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#3c9d62] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[#3c9d62]" />
          </span>
          Movement kit
        </span>
        Camera and projector ready
      </div>
    </aside>
  )
}

function TypingQuote({ text }: { text: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? text.length : 0)
  useEffect(() => {
    if (reduce) return
    const start = setTimeout(() => {
      const id = setInterval(() => setShown((count) => (count >= text.length ? (clearInterval(id), count) : count + 2)), 22)
    }, 900)
    return () => clearTimeout(start)
  }, [text, reduce])
  const typing = shown === 0
  return (
    <blockquote className="mt-4 min-h-[96px] rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-[#2a4034]">
      {typing ? (
        <span className="flex gap-1 py-2" aria-label="Maya is typing">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="size-2 rounded-full bg-[#14684a]"
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.15 }}
            />
          ))}
        </span>
      ) : (
        <>“{text.slice(0, shown)}{shown < text.length ? <span className="animate-pulse">▍</span> : "”"}</>
      )}
    </blockquote>
  )
}

export function VariantA() {
  const { state, derived } = useStride()
  const level = derived.prescribed
  const maya = [...state.messages].reverse().find((message) => message.from === "maya")
  const recent = derived.recent.slice(0, 3)

  return (
    <div className={cn(fredoka.variable, lilita.variable, "min-h-screen bg-[#f3f6f2] text-[#1a2b22]")}>
      <div className="mx-auto flex max-w-[1440px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <BlurFade delay={0.05}>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#5c6e64]">{formatHeading(derived.now)}</p>
            <h1 className="mt-1 text-[1.85rem] font-semibold tracking-tight sm:text-4xl">{greeting(derived.now)}, Jordan.</h1>
            <p className="mt-1.5 text-sm text-[#5c6e64]">Gus needs a few more walks to get home before sunrise.</p>
          </BlurFade>

          <BlurFade delay={0.15}>
            <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#070b10] text-white shadow-[0_24px_60px_rgba(7,11,16,0.35)]">
              <Parallax className="absolute inset-0" strength={18}>
                <video className="size-full object-cover object-right" autoPlay muted loop playsInline preload="auto" poster="/images/hero-night-a.webp" aria-hidden="true">
                  <source src="/video/hero-loop.webm" type="video/webm" />
                  <source src="/video/hero-loop.mp4" type="video/mp4" />
                </video>
              </Parallax>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#070b10_0%,rgba(7,11,16,0.92)_30%,rgba(7,11,16,0.2)_62%,transparent_100%)]" />
              <Particles className="pointer-events-none absolute inset-0" quantity={46} staticity={40} ease={60} size={0.9} color="#ffd76a" />
              <div className="relative z-10 flex min-h-[380px] flex-col justify-center px-6 py-8 sm:px-9 lg:max-w-[52%]">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-white/70">
                  <span>TONIGHT&apos;S WALK</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-[#ffd76a]">{level.minutes} MIN</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 tracking-normal text-[#9cff5a]">LEVEL {formatLevel(level.id)}</span>
                </div>
                <h2 className={cn(lilita.className, "mt-4 text-5xl leading-[0.95] text-[#ffd76a] drop-shadow-[0_4px_0_#0b1a14] sm:text-6xl")}>
                  <PopTitle text={level.name} delay={0.35} />
                </h2>
                <p className="mt-3 max-w-md text-[15px] leading-6 text-white/80">{level.summary}</p>
                <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/90">
                  {level.focus.map((item, index) => (
                    <motion.li
                      key={item}
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + index * 0.12 }}
                    >
                      <span className="grid size-5 place-items-center rounded-full bg-[#9cff5a]/15 text-[11px] font-semibold text-[#9cff5a]">{index + 1}</span>
                      {item}
                    </motion.li>
                  ))}
                </ol>
                <div className="mt-7">
                  <Magnetic>
                    <Link
                      href={`/play/session?level=${level.id}`}
                      className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-[#ffb21e] px-6 text-[15px] font-bold text-[#1a1408] shadow-[0_6px_0_#a8690b,0_14px_30px_rgba(255,178,30,0.35)] transition active:translate-y-1 active:shadow-[0_2px_0_#a8690b]"
                    >
                      <span className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/50 blur-sm transition-all duration-700 group-hover:left-[120%]" />
                      Start tonight&apos;s walk
                      <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </section>
          </BlurFade>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <BlurFade delay={0.3}>
              <MagicCard className="rounded-[24px] p-5" gradientColor="#e5f3e8" gradientFrom="#9cff5a" gradientTo="#2de2c4">
                <div className="flex items-center gap-4">
                  <AnimatedCircularProgressBar value={derived.walkingScore} gaugePrimaryColor="#14684a" gaugeSecondaryColor="#e5f0e8" className="size-24 text-xl [&>span]:opacity-0" />
                  <div>
                    <p className="text-sm text-[#5c6e64]">Walking score</p>
                    <p className="text-[2.6rem] font-semibold leading-none tabular-nums">
                      <NumberTicker value={derived.walkingScore} delay={0.4} />
                      <span className="ml-1 text-lg text-[#5c6e64]">/100</span>
                    </p>
                    <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", derived.scoreDelta >= 0 ? "bg-[#e5f6ea] text-[#1c7a45]" : "bg-[#fdf3ea] text-[#e8893c]")}>
                      {derived.scoreDelta > 0 ? "+" : ""}
                      {derived.scoreDelta}% this week
                    </span>
                  </div>
                </div>
              </MagicCard>
            </BlurFade>
            <BlurFade delay={0.4}>
              <MagicCard className="rounded-[24px] p-5" gradientColor="#fdf3ea" gradientFrom="#ffb21e" gradientTo="#ff3d8b">
                <p className="text-sm text-[#5c6e64]">Practice time this week</p>
                <p className="mt-1 text-[2.6rem] font-semibold leading-none tabular-nums">
                  <NumberTicker value={derived.weekMinutes} delay={0.5} />
                  <span className="ml-1 text-lg text-[#5c6e64]">min</span>
                </p>
                <div className="mt-3">
                  <SpringBars days={derived.week} barClass="bg-[#d5e6da]" hotClass="bg-[#e8893c]" />
                </div>
              </MagicCard>
            </BlurFade>
            <BlurFade delay={0.5}>
              <article className="h-full rounded-[24px] bg-[#e8f5eb] p-5">
                <div className="flex items-center gap-3">
                  <Bob src="/art/flower-rose.png" className="size-11" />
                  <div>
                    <p className="text-sm font-semibold">Maya, your AI therapist</p>
                    <p className="text-xs text-[#5c6e64]">Reviewed your last walk</p>
                  </div>
                </div>
                <TypingQuote text={maya?.text ?? "Finish a scored walk and I will have a note waiting."} />
              </article>
            </BlurFade>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_0.9fr]">
            <BlurFade delay={0.55}>
              <article className="rounded-[24px] bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.05)] sm:p-6">
                <h2 className="text-lg font-semibold">Recent walks</h2>
                <ul className="mt-3 divide-y divide-[#dce6df]">
                  {recent.map((session, index) => (
                    <motion.li
                      key={session.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + index * 0.08 }}
                      whileHover={{ x: 4 }}
                      className="group flex items-center gap-3 py-3.5"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#10281d] transition group-hover:rotate-[-6deg] group-hover:scale-110">
                        <img src={LEVEL_MARKS[session.levelId] ?? "/art/flower-marigold.png"} alt="" className="size-9 object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{session.levelName}</span>
                        <span className="block text-sm text-[#5c6e64]">
                          {formatWhen(session.playedAt, derived.now)} · {formatMinutes(session.durationMin)}
                        </span>
                      </span>
                      <span className="text-right font-semibold tabular-nums">{session.walkingScore}</span>
                      <ChevronRight className="size-4 text-[#5c6e64]" />
                    </motion.li>
                  ))}
                </ul>
              </article>
            </BlurFade>
            <BlurFade delay={0.65}>
              <article className="relative h-full overflow-hidden rounded-[24px] bg-[#fdf3ea] p-5 sm:p-6">
                <Bob src="/art/moon.png" className="absolute right-3 top-3 size-16" />
                <h2 className="text-lg font-semibold">Current streak</h2>
                <p className="mt-3 text-5xl font-semibold tabular-nums">
                  <NumberTicker value={derived.streak} delay={0.8} />
                  <span className="ml-2 text-lg font-medium text-[#8a6244]">nights</span>
                </p>
                <div className="mt-5 flex gap-2">
                  {derived.week.map((day, index) => (
                    <motion.span
                      key={day.key}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.9 + index * 0.06 }}
                      className={cn(
                        "grid size-9 flex-1 place-items-center rounded-full text-xs font-semibold",
                        day.hasSession ? "bg-[#e8893c] text-white" : day.isToday ? "bg-white text-[#e8893c] ring-2 ring-[#e8893c]" : "bg-[#f3e4d4] text-[#b08968]",
                      )}
                    >
                      {day.hasSession ? <Check className="size-4" /> : day.label}
                    </motion.span>
                  ))}
                </div>
              </article>
            </BlurFade>
          </section>
        </main>
      </div>
      <VariantSwitch />
    </div>
  )
}
