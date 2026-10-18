"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatLevel, formatWhen, greeting } from "@/lib/format"
import { useStride } from "@/lib/store"
import { Bob, Magnetic, NAV, Parallax, PopTitle, SpringBars, Tilt, VariantSwitch, fredoka } from "@/components/lab/shared"
import { cn } from "cn"

const STICKER = "rounded-[26px] border-[2.5px] border-[#173026] shadow-[5px_5px_0_#173026]"

const COLLECTION = [
  { src: "/art/flower-marigold.png", name: "Marmalade" },
  { src: "/art/flower-bell.png", name: "Ding-Dong" },
  { src: "/art/flower-rose.png", name: "Rosie" },
  { src: "/art/pod.png", name: "Pip" },
  { src: "/art/moon.png", name: "Moon" },
  { src: "/art/house.png", name: "Home" },
]

function TopNav() {
  return (
    <header className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2">
        <motion.span
          className={cn(STICKER, "grid size-11 place-items-center bg-[#9cff5a] shadow-[3px_3px_0_#173026]")}
          whileHover={{ rotate: -10, scale: 1.08 }}
        >
          <img src="/art/gus-portrait.png" alt="" className="size-9" />
        </motion.span>
        <span className="text-2xl font-bold tracking-tight text-[#173026]">
          Zombie Walk <span className="text-[#e8893c]">Home</span>
        </span>
      </div>
      <nav className="hidden gap-1 rounded-full border-[2.5px] border-[#173026] bg-white p-1 md:flex">
        {NAV.map((item, index) => (
          <span key={item.href} className="relative rounded-full px-4 py-1.5 text-sm font-semibold">
            {index === 0 ? <motion.span layoutId="c-nav" className="absolute inset-0 rounded-full bg-[#173026]" /> : null}
            <span className={cn("relative", index === 0 ? "text-white" : "text-[#173026]")}>{item.label}</span>
          </span>
        ))}
      </nav>
    </header>
  )
}

export function VariantC() {
  const { state, derived } = useStride()
  const level = derived.prescribed
  const maya = [...state.messages].reverse().find((message) => message.from === "maya")
  const unlocked = Math.min(COLLECTION.length, derived.levels.filter((item) => item.status === "done").length + 1)

  return (
    <div
      className={cn(
        fredoka.className,
        "min-h-screen bg-[#fbf6ec] bg-[radial-gradient(#e9dcc4_1.2px,transparent_1.2px)] [background-size:22px_22px] text-[#173026]",
      )}
    >
      <div className="mx-auto max-w-[1280px] px-4 pb-28 sm:px-6">
        <TopNav />
        <BlurFade delay={0.05}>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {greeting(derived.now)}, Jordan <motion.span className="inline-block" animate={{ rotate: [0, 18, -8, 18, 0] }} transition={{ duration: 1.4, delay: 0.6 }}>👋</motion.span>
          </h1>
          <p className="mt-1 text-lg text-[#5c6e64]">Tonight&apos;s chapter: help Gus tiptoe home before the sun comes up.</p>
        </BlurFade>

        <div className="mt-6 grid auto-rows-[minmax(150px,auto)] gap-5 md:grid-cols-4">
          <BlurFade delay={0.15} className="md:col-span-3 md:row-span-2">
            <Tilt className="h-full rounded-[30px]" max={3}>
              <section className={cn(STICKER, "relative h-full min-h-[420px] overflow-hidden bg-[#070b10]")}>
                <Parallax className="absolute inset-0" strength={16}>
                  <video className="size-full object-cover object-right" autoPlay muted loop playsInline preload="auto" poster="/images/hero-night-a.webp" aria-hidden="true">
                  <source src="/video/hero-loop.webm" type="video/webm" />
                  <source src="/video/hero-loop.mp4" type="video/mp4" />
                </video>
                </Parallax>
                <div className="absolute bottom-5 left-5 max-w-md rotate-[-1.5deg] rounded-[22px] border-[2.5px] border-[#173026] bg-[#fbf6ec] p-5 shadow-[5px_5px_0_#173026]">
                  <p className="text-xs font-bold tracking-[0.16em] text-[#e8893c]">CHAPTER {formatLevel(level.id)} · {level.minutes} MIN</p>
                  <h2 className="mt-1 text-4xl font-bold leading-none">
                    <PopTitle text={level.name} delay={0.4} />
                  </h2>
                  <p className="mt-2 text-[15px] leading-6 text-[#41564a]">{level.summary}</p>
                  <div className="mt-4">
                    <Magnetic>
                      <Link
                        href={`/play/session?level=${level.id}`}
                        className="inline-flex h-12 items-center gap-2 rounded-full border-[2.5px] border-[#173026] bg-[#ffb21e] px-6 text-[15px] font-bold shadow-[3px_3px_0_#173026] transition hover:-translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                      >
                        Start the walk <ArrowRight className="size-4" />
                      </Link>
                    </Magnetic>
                  </div>
                </div>
              </section>
            </Tilt>
          </BlurFade>

          <BlurFade delay={0.25}>
            <motion.article whileHover={{ rotate: -1.5, y: -4 }} className={cn(STICKER, "h-full bg-[#d9f7c4] p-5")}>
              <p className="text-sm font-semibold">Walking score</p>
              <p className="text-6xl font-bold tabular-nums">
                <NumberTicker value={derived.walkingScore} delay={0.4} />
              </p>
              <p className="mt-1 text-sm">{derived.scoreDelta >= 0 ? "Up" : "Down"} {Math.abs(derived.scoreDelta)}% this week</p>
            </motion.article>
          </BlurFade>

          <BlurFade delay={0.32}>
            <motion.article whileHover={{ rotate: 1.5, y: -4 }} className={cn(STICKER, "relative h-full overflow-hidden bg-[#ffe3cc] p-5")}>
              <Bob src="/art/moon.png" className="absolute -right-2 -top-2 size-16" />
              <p className="text-sm font-semibold">Night streak</p>
              <p className="text-6xl font-bold tabular-nums">
                <NumberTicker value={derived.streak} delay={0.5} />
              </p>
              <p className="mt-1 text-sm">Best: {state.bestStreak} nights</p>
            </motion.article>
          </BlurFade>

          <BlurFade delay={0.4} className="md:col-span-2">
            <motion.article whileHover={{ y: -4 }} className={cn(STICKER, "h-full bg-[#e6dcff] p-5")}>
              <div className="flex items-end justify-between">
                <p className="text-sm font-semibold">Minutes this week</p>
                <p className="text-4xl font-bold tabular-nums">
                  <NumberTicker value={derived.weekMinutes} delay={0.6} />
                </p>
              </div>
              <div className="mt-2">
                <SpringBars days={derived.week} barClass="bg-[#a46bff]/40" hotClass="bg-[#a46bff]" />
              </div>
            </motion.article>
          </BlurFade>

          <BlurFade delay={0.48} className="md:col-span-2">
            <motion.article whileHover={{ y: -4 }} className={cn(STICKER, "flex h-full gap-4 bg-[#d3f4ff] p-5")}>
              <Bob src="/art/flower-rose.png" className="size-16 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Maya, your AI therapist</p>
                <motion.p
                  className="relative mt-2 rounded-2xl rounded-tl-sm border-[2px] border-[#173026] bg-white px-4 py-3 text-[15px] leading-6"
                  initial={{ opacity: 0, scale: 0.85, originX: 0, originY: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.9 }}
                >
                  {maya?.text ?? "Finish a walk and I will have a note waiting."}
                </motion.p>
              </div>
            </motion.article>
          </BlurFade>

          <BlurFade delay={0.55} className="md:col-span-4">
            <article className={cn(STICKER, "bg-white p-5")}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold">Garden sticker book</h2>
                <span className="text-sm text-[#5c6e64]">{unlocked} of {COLLECTION.length} friends met</span>
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
                {COLLECTION.map((item, index) => {
                  const got = index < unlocked
                  return (
                    <motion.li
                      key={item.name}
                      className="flex flex-col items-center gap-1"
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.8 + index * 0.08 }}
                      whileHover={got ? { scale: 1.12, rotate: [0, -8, 8, 0] } : undefined}
                    >
                      <span className={cn("grid size-20 place-items-center rounded-full border-[2.5px] border-dashed", got ? "border-[#173026] bg-[#fbf6ec]" : "border-[#c9bfa9]")}>
                        <img src={item.src} alt="" className={cn("size-14 object-contain", !got && "opacity-30 brightness-0")} />
                      </span>
                      <span className="text-xs font-semibold">{got ? item.name : "???"}</span>
                    </motion.li>
                  )
                })}
              </ul>
            </article>
          </BlurFade>

          <BlurFade delay={0.6} className="md:col-span-4">
            <article className={cn(STICKER, "bg-white p-5")}>
              <h2 className="text-xl font-bold">Last walks</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {derived.recent.slice(0, 3).map((session) => (
                  <motion.li key={session.id} whileHover={{ y: -3 }} className="rounded-2xl bg-[#fbf6ec] px-4 py-3">
                    <p className="font-semibold">{session.levelName}</p>
                    <p className="text-sm text-[#5c6e64]">{formatWhen(session.playedAt, derived.now)} · score {session.walkingScore}</p>
                  </motion.li>
                ))}
              </ul>
            </article>
          </BlurFade>
        </div>
      </div>
      <VariantSwitch />
    </div>
  )
}
