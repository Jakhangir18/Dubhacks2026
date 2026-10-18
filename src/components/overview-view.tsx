"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Moon, Play } from "lucide-react"
import { Bob, Magnetic, Parallax, PopTitle, SpringBars, Tilt } from "@/components/motion"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Particles } from "@/components/ui/particles"
import { formatLevel, formatMinutes, formatWhen, greeting } from "@/lib/format"
import { LEVEL_MARKS } from "@/lib/levels"
import { streakCopy } from "@/lib/metrics"
import { GAME_BUTTON, MAYA_AVATAR, ZOMBIE, sticker } from "@/lib/sticker"
import { useStride } from "@/lib/store"
import { cn } from "cn"

/** Garden friends the player meets as gardens are cleared (Umami Land-style collectibles). */
const COLLECTION = [
  { src: "/art/flower-marigold.png", name: "Marmalade" },
  { src: "/art/flower-bell.png", name: "Ding-Dong" },
  { src: "/art/flower-rose.png", name: "Rosie" },
  { src: "/art/pod.png", name: "Pip" },
  { src: "/art/moon.png", name: "Moon" },
  { src: "/art/house.png", name: "Home" },
]

/** The zombie shuffles along the track toward his cottage, like the in-game top bar. */
export function HomeTrack({ progress }: { progress: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="relative mt-5 h-12" role="img" aria-label={`${progress}% of the way home`}>
      <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-full border-[2.5px] border-[#0b1a14] bg-[#14242a]">
        <motion.div
          className="h-full origin-left rounded-full bg-[linear-gradient(90deg,#4f8f22,#9cff5a_80%,#ffb21e)]"
          style={{ width: `${progress}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
        />
      </div>
      { }
      <motion.img
        src={ZOMBIE.walk}
        alt=""
        className="absolute top-1/2 h-14 -translate-x-1/2 -translate-y-[72%]"
        initial={{ left: "0%" }}
        animate={{ left: `${progress}%`, rotate: [0, -5, 5, 0] }}
        transition={{ left: { duration: reduce ? 0 : 1.6, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.6 }, rotate: { duration: 0.6, repeat: Infinity } }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/house.png" alt="" className="absolute -top-3 right-0 h-14" />
    </div>
  )
}

export function OverviewView() {
  const { state, derived } = useStride()
  const level = derived.prescribed
  const maya = [...state.messages].reverse().find((message) => message.from === "maya")
  const done = derived.levels.filter((item) => item.status === "done").length
  const progress = Math.round(((done + 0.5) / Math.max(derived.levels.length, 1)) * 100)
  const unlocked = Math.min(COLLECTION.length, done + 1)

  return (
    <div>
      <BlurFade delay={0.05}>
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#2de2c4]">NIGHT {derived.streak + 1} · GRANDMA ROSA&apos;S GARDEN</p>
        <h1 className="font-display mt-1 text-4xl tracking-wide sm:text-5xl">{greeting(derived.now)}, Jordan!</h1>
        <p className="mt-1 text-lg text-white/70">Tonight&apos;s chapter: help Gus shuffle home before the sun comes up.</p>
      </BlurFade>

      <div className="mt-6 grid auto-rows-[minmax(150px,auto)] gap-5 md:grid-cols-4">
        <BlurFade delay={0.15} className="md:col-span-3 md:row-span-2">
          <Tilt className="h-full rounded-[30px]" max={3}>
            <section className={sticker("lime", "relative h-full min-h-[460px] overflow-hidden bg-[#070b10]")}>
              <Parallax className="absolute inset-0" strength={16}>
                <video
                  className="size-full object-cover object-right"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  poster="/images/hero-night-z.webp"
                  aria-hidden="true"
                >
                  <source src="/video/hero-zombie.webm" type="video/webm" />
                  <source src="/video/hero-zombie.mp4" type="video/mp4" />
                </video>
              </Parallax>
              <Particles className="pointer-events-none absolute inset-0" quantity={30} staticity={30} size={1} color="#ffd76a" />
              <div className={sticker("ink", "absolute inset-x-4 bottom-4 max-w-lg rotate-[-1.2deg] p-5 sm:right-auto sm:left-5 sm:bottom-5")}>
                <p className="text-xs font-bold tracking-[0.16em] text-[#ffb21e]">
                  CHAPTER {formatLevel(level.id)} · {level.minutes} MIN · {level.chip.toUpperCase()}
                </p>
                <h2 className="font-display text-outline mt-1 text-[2rem] leading-none tracking-wide text-[#ffd76a] sm:text-[2.6rem]">
                  <PopTitle text={level.name.toUpperCase()} delay={0.4} />
                </h2>
                <p className="mt-2 text-[15px] leading-6 text-white/75">{level.summary}</p>
                <HomeTrack progress={progress} />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Magnetic>
                    <Link href={`/play/session?level=${level.id}`} className={GAME_BUTTON}>
                      <Play className="size-5 fill-current" /> PLAY
                    </Link>
                  </Magnetic>
                  <span className="text-sm text-white/65">
                    {done} of {derived.levels.length} gardens cleared
                  </span>
                </div>
              </div>
            </section>
          </Tilt>
        </BlurFade>

        <BlurFade delay={0.25}>
          <Link href="/progress" className="block h-full">
            <motion.article whileHover={{ rotate: -1.5, y: -4 }} className={sticker("teal", "h-full p-5")}>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">WALKING SCORE</p>
              <p className="font-display text-outline text-6xl text-[#9cff5a] tabular-nums">
                <NumberTicker value={derived.walkingScore} delay={0.4} />
              </p>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <motion.span
                    key={index}
                    className={cn("h-2.5 flex-1 origin-bottom rounded-sm", index < Math.round(derived.walkingScore / 10) ? "bg-[#2de2ff]" : "bg-white/10")}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.5 + index * 0.05 }}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-white/65">
                {derived.scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(derived.scoreDelta)}% this week
              </p>
            </motion.article>
          </Link>
        </BlurFade>

        <BlurFade delay={0.32}>
          <motion.article whileHover={{ rotate: 1.5, y: -4 }} className={sticker("amber", "relative h-full overflow-hidden p-5")}>
            <Bob src="/art/moon.png" className="absolute -right-2 -top-2 size-16" />
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">NIGHT STREAK</p>
            <p className="font-display text-outline text-6xl text-[#ffd76a] tabular-nums">
              <NumberTicker value={derived.streak} delay={0.5} />
            </p>
            <div className="mt-2 flex gap-1">
              {derived.week.map((day, index) => (
                <motion.span
                  key={day.key}
                  className={cn(
                    "grid h-7 flex-1 place-items-center rounded-lg text-[10px] font-bold",
                    day.hasSession ? "bg-[#ffd76a] text-[#0b1a14]" : day.isToday ? "bg-white/10 text-[#ffd76a] ring-2 ring-[#ffd76a]" : "bg-white/10 text-white/50",
                  )}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.7 + index * 0.05 }}
                  aria-label={`${day.label} ${day.hasSession ? "practiced" : day.isToday ? "today, not yet" : "no session"}`}
                >
                  {day.hasSession ? <Moon className="size-3.5 fill-current" /> : day.label}
                </motion.span>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-white/65">{streakCopy(state, derived)}</p>
          </motion.article>
        </BlurFade>

        <BlurFade delay={0.4} className="md:col-span-2">
          <motion.article whileHover={{ y: -4 }} className={sticker("violet", "h-full p-5")}>
            <div className="flex items-end justify-between">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#c9a8ff]">MINUTES THIS WEEK</p>
              <p className="font-display text-outline text-5xl text-white tabular-nums">
                <NumberTicker value={derived.weekMinutes} delay={0.6} />
              </p>
            </div>
            <div className="mt-3">
              <SpringBars days={derived.week} barClass="bg-[#a46bff]/40" hotClass="bg-[#ffb21e]" labelClass="text-white/70" />
            </div>
          </motion.article>
        </BlurFade>

        <BlurFade delay={0.48} className="md:col-span-2">
          <Link href="/therapist" className="block h-full">
            <motion.article whileHover={{ y: -4 }} className={sticker("rose", "flex h-full gap-4 p-5")}>
              <Bob src={MAYA_AVATAR} alt="Maya, the Zombie Walk Home AI therapist" className="size-20 shrink-0 rounded-full bg-[#ffd6e7] object-contain ring-[2.5px] ring-[#ff3d8b]" />
              <div className="min-w-0">
                <p className="font-display text-xl tracking-wide text-[#ff3d8b]">MAYA SAYS</p>
                <motion.p
                  className="relative mt-2 rounded-2xl rounded-tl-sm border-[2.5px] border-[#0b1a14] bg-white px-4 py-3 text-[15px] font-medium leading-6 text-[#0b1a14]"
                  initial={{ opacity: 0, scale: 0.85, originX: 0, originY: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.9 }}
                >
                  {maya?.text ?? "Finish a walk and I will have a note waiting."}
                </motion.p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#ff8fbf]">
                  Talk to Maya <ArrowRight className="size-4" />
                </span>
              </div>
            </motion.article>
          </Link>
        </BlurFade>

        <BlurFade delay={0.55} className="md:col-span-4">
          <article className={sticker("ink", "p-5")}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-wide">GARDEN STICKER BOOK</h2>
              <span className="text-sm text-white/60">
                {unlocked} of {COLLECTION.length} friends met
              </span>
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
                    <span
                      className={cn(
                        "grid size-20 place-items-center rounded-full border-[2.5px] border-dashed",
                        got ? "border-[#9cff5a] bg-[#12261a] shadow-[0_0_24px_rgba(156,255,90,0.25)]" : "border-white/15",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt="" className={cn("size-14 object-contain", !got && "opacity-25 brightness-0 invert")} />
                    </span>
                    <span className="text-xs font-semibold text-white/80">{got ? item.name : "???"}</span>
                  </motion.li>
                )
              })}
            </ul>
          </article>
        </BlurFade>

        <BlurFade delay={0.6} className="md:col-span-4">
          <article className={sticker("ink", "p-5")}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl tracking-wide">LAST WALKS</h2>
              <Link href="/activity" className="text-sm font-semibold text-[#9cff5a] hover:underline">
                View all
              </Link>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {derived.recent.slice(0, 3).map((session) => (
                <motion.li key={session.id} whileHover={{ y: -3 }}>
                  <Link
                    href={`/activity?session=${session.id}`}
                    className="group flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 transition hover:bg-[#9cff5a]/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LEVEL_MARKS[session.levelId] ?? "/art/flower-marigold.png"} alt="" className="size-10 object-contain transition group-hover:-rotate-12 group-hover:scale-110" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{session.levelName}</span>
                      <span className="block text-sm text-white/60">
                        {formatWhen(session.playedAt, derived.now)} · {formatMinutes(session.durationMin)}
                      </span>
                    </span>
                    <span className="font-display text-3xl text-[#9cff5a] tabular-nums">{session.walkingScore}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </article>
        </BlurFade>
      </div>
    </div>
  )
}
