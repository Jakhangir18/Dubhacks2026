"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Moon, Play, Smartphone } from "lucide-react"
import { GameControlCompact } from "@/components/game-control"
import { Bob, Magnetic, Parallax, PopTitle, SpringBars, Tilt } from "@/components/motion"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Particles } from "@/components/ui/particles"
import { DemoTag, MomentCard, NumberGrid, WalkWords, walkFigures } from "@/components/walk-bits"
import { api, useMounted, usePoll } from "@/lib/game"
import { useGame } from "@/lib/game-data"
import { useGameScreen, useSideCamera } from "@/lib/live"
import { asset } from "@/lib/paths"
import { GAME_BUTTON, MAYA_AVATAR, ZOMBIE, sticker } from "@/lib/sticker"
import { clockLabel, durationLabel, mayaLine, startOfWeekLocal, streakOf, weekOf, whenLabel, type Walk } from "@/lib/walks"
import { cn } from "cn"

/** Garden friends the player meets as walks reach home (Umami Land-style collectibles). */
const COLLECTION = [
  { src: "/art/flower-marigold.png", name: "Marmalade" },
  { src: "/art/flower-bell.png", name: "Ding-Dong" },
  { src: "/art/flower-rose.png", name: "Rosie" },
  { src: "/art/pod.png", name: "Pip" },
  { src: "/art/moon.png", name: "Moon" },
  { src: "/art/house.png", name: "Home" },
]

function greet(date: Date) {
  const hour = date.getHours()
  if (hour >= 4 && hour < 12) return "Good morning"
  if (hour >= 12 && hour < 17) return "Good afternoon"
  if (hour >= 17 && hour < 22) return "Good evening"
  return "Hello"
}

/** How far Gus got on the latest walk: home is the house; a walk cut short stops along the track. */
function walkProgress(walk: Walk | null) {
  if (!walk) return 4
  if (walk.home) return 100
  if (walk.rounds) return Math.min(88, Math.round((walk.rounds / (walk.rounds + 1)) * 100))
  return 24
}

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
      <motion.img
        src={ZOMBIE.walk}
        alt=""
        className="absolute top-1/2 h-14 -translate-x-1/2 -translate-y-[72%]"
        initial={{ left: "0%" }}
        animate={{ left: `${progress}%`, rotate: [0, -5, 5, 0] }}
        transition={{ left: { duration: reduce ? 0 : 1.6, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.6 }, rotate: { duration: 0.6, repeat: Infinity } }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("/art/house.png")} alt="" className="absolute -top-3 right-0 h-14" />
    </div>
  )
}

export function OverviewView() {
  const { player, walks, latest, demo, loading, running } = useGame()
  const side = useSideCamera()
  const game = useGameScreen()
  const mounted = useMounted()
  const now = new Date(side.now)
  const week = weekOf(walks, startOfWeekLocal(now), now)
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0)
  const streak = streakOf(walks, now)
  const homes = walks.filter((walk) => walk.home).length
  const unlocked = Math.min(COLLECTION.length, homes)
  const progress = walkProgress(latest)
  const maya = mayaLine(latest)
  const moments = usePoll(
    () => (latest && !latest.demo && latest.openable ? api.moments(latest.id) : Promise.resolve([])),
    20000,
    Boolean(latest),
    latest?.id ?? "",
  )
  const latestMoments = (moments.data ?? []).slice().reverse().slice(0, 2)
  const firstName = player.split(" ")[0]

  return (
    <div>
      <BlurFade delay={0.05}>
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-[#2de2c4]">
          <span>TONIGHT · {player.toUpperCase()}</span>
          {demo ? <DemoTag /> : null}
        </p>
        <h1 className="font-display mt-1 text-4xl tracking-wide sm:text-5xl">{mounted ? greet(now) : "Hello"}, {firstName}!</h1>
        <p className="mt-1 text-lg text-white/70">Tonight&apos;s chapter: help Gus shuffle home before the sun comes up.</p>
      </BlurFade>

      <BlurFade delay={0.08}>
        <div className="mt-5">
          <GameControlCompact game={game} />
        </div>
      </BlurFade>

      {side.polled && !side.live ? (
        <BlurFade delay={0.1}>
          <Link href="/play" className="mt-5 block">
            <motion.div whileHover={{ y: -2 }} className={sticker("amber", "flex items-center gap-3 rounded-[22px] px-4 py-3")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[#0b1a14] bg-[#ffb21e] text-[#0b1a14]">
                <Smartphone className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-white">Connect the phone to see your walk live</span>
                <span className="block text-sm text-white/65">The phone at the side of the pad draws your legs and shows what to fix, in pictures.</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-[#ffd76a]" />
            </motion.div>
          </Link>
        </BlurFade>
      ) : null}

      <div className="mt-6 grid auto-rows-[minmax(150px,auto)] gap-5 md:grid-cols-4">
        <BlurFade delay={0.15} className="md:col-span-3 md:row-span-2">
          <Tilt className="h-full rounded-[30px]" max={3}>
            <section className={sticker("lime", "relative h-full min-h-[520px] overflow-hidden bg-[#070b10]")}>
              <Parallax className="absolute inset-0" strength={16}>
                <video
                  className="size-full object-cover object-right"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  poster={asset("/images/hero-night-z.webp")}
                  aria-hidden="true"
                >
                  <source src={asset("/video/hero-zombie.webm")} type="video/webm" />
                  <source src={asset("/video/hero-zombie.mp4")} type="video/mp4" />
                </video>
              </Parallax>
              <Particles className="pointer-events-none absolute inset-0" quantity={30} staticity={30} size={1} color="#ffd76a" />
              <div className={sticker("ink", "absolute inset-x-4 bottom-4 max-w-xl rotate-[-1.2deg] p-5 sm:right-auto sm:left-5 sm:bottom-5")}>
                {latest ? (
                  <>
                    <p className="text-xs font-bold tracking-[0.16em] text-[#ffb21e]">
                      LATEST WALK · {whenLabel(latest.at, now).toUpperCase()} {clockLabel(latest.at).toUpperCase()} · {durationLabel(latest.seconds).toUpperCase()}
                    </p>
                    <h2 className="font-display text-outline mt-1 text-[2rem] leading-none tracking-wide text-[#ffd76a] sm:text-[2.6rem]">
                      <PopTitle text={latest.home ? "GUS GOT HOME" : "A SHORT WALK"} delay={0.4} />
                    </h2>
                    <WalkWords walk={latest} moments={moments.data ?? []} compact className="mt-3" />
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold tracking-[0.16em] text-[#ffb21e]">{loading ? "LOOKING FOR YOUR WALKS" : "NO WALK YET"}</p>
                    <h2 className="font-display text-outline mt-1 text-[2rem] leading-none tracking-wide text-[#ffd76a] sm:text-[2.6rem]">
                      <PopTitle text="THE GARDEN WAITS" delay={0.4} />
                    </h2>
                    <p className="mt-2 text-[15px] leading-6 text-white/75">Step onto the pad; the first walk lands here with Maya&apos;s note.</p>
                  </>
                )}
                <HomeTrack progress={progress} />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Magnetic>
                    <Link href="/play" className={GAME_BUTTON}>
                      <Play className="size-5 fill-current" /> {running ? "WATCH LIVE" : "LIVE WALK"}
                    </Link>
                  </Magnetic>
                  {latest?.openable ? (
                    <Link href={`/play/session?id=${encodeURIComponent(latest.id)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#9cff5a] hover:underline">
                      See the whole walk <ArrowRight className="size-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          </Tilt>
        </BlurFade>

        <BlurFade delay={0.25}>
          <Link href="/progress" className="block h-full">
            <motion.article whileHover={{ rotate: -1.5, y: -4 }} className={sticker("teal", "h-full p-5")}>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">FLOWERS HIT</p>
              <p className="font-display text-outline text-6xl text-[#9cff5a] tabular-nums">
                {latest?.flowersPct !== null && latest?.flowersPct !== undefined ? (
                  <>
                    <NumberTicker value={latest.flowersPct} delay={0.4} />
                    <span className="text-3xl">%</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <motion.span
                    key={index}
                    className={cn("h-2.5 flex-1 origin-bottom rounded-sm", index < Math.round((latest?.flowersPct ?? 0) / 10) ? "bg-[#2de2ff]" : "bg-white/10")}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.5 + index * 0.05 }}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-white/65">
                {walks.length} {walks.length === 1 ? "walk" : "walks"} on record · {homes} home
              </p>
            </motion.article>
          </Link>
        </BlurFade>

        <BlurFade delay={0.32}>
          <motion.article whileHover={{ rotate: 1.5, y: -4 }} className={sticker("amber", "relative h-full overflow-hidden p-5")}>
            <Bob src={asset("/art/moon.png")} className="absolute -right-2 -top-2 size-16" />
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">NIGHT STREAK</p>
            <p className="font-display text-outline text-6xl text-[#ffd76a] tabular-nums">
              <NumberTicker value={streak} delay={0.5} />
            </p>
            <div className="mt-2 flex gap-1">
              {week.map((day, index) => (
                <motion.span
                  key={day.key}
                  className={cn(
                    "grid h-7 flex-1 place-items-center rounded-lg text-[10px] font-bold",
                    day.hasSession ? "bg-[#ffd76a] text-[#0b1a14]" : day.isToday ? "bg-white/10 text-[#ffd76a] ring-2 ring-[#ffd76a]" : "bg-white/10 text-white/50",
                  )}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.7 + index * 0.05 }}
                  aria-label={`${day.label} ${day.hasSession ? "walked" : day.isToday ? "today, not yet" : "no walk"}`}
                >
                  {day.hasSession ? <Moon className="size-3.5 fill-current" /> : day.label}
                </motion.span>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-white/65">
              {streak === 0 ? "A walk tonight starts a new streak." : week[week.length - 1].hasSession || week.find((day) => day.isToday)?.hasSession ? "Streak held. The next one counts tomorrow." : "Walk today and the streak holds."}
            </p>
          </motion.article>
        </BlurFade>

        <BlurFade delay={0.4} className="md:col-span-2">
          <article className={sticker("ink", "h-full p-5")}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-wide">THE NUMBERS</h2>
              {latest ? <span className="text-sm text-white/60">{whenLabel(latest.at, now)}</span> : null}
            </div>
            {latest ? (
              <NumberGrid figures={walkFigures(latest)} className="mt-3" delay={0.5} />
            ) : (
              <p className="mt-3 text-sm text-white/60">The first walk fills this in.</p>
            )}
          </article>
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
                  {maya ?? "Finish a walk and I will have a note waiting."}
                </motion.p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#ff8fbf]">
                  Talk to Maya <ArrowRight className="size-4" />
                </span>
              </div>
            </motion.article>
          </Link>
        </BlurFade>

        <BlurFade delay={0.52} className="md:col-span-2">
          <motion.article whileHover={{ y: -4 }} className={sticker("violet", "h-full p-5")}>
            <div className="flex items-end justify-between">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#c9a8ff]">MINUTES THIS WEEK</p>
              <p className="font-display text-outline text-5xl text-white tabular-nums">
                <NumberTicker value={weekMinutes} delay={0.6} />
              </p>
            </div>
            <div className="mt-3">
              <SpringBars days={week} barClass="bg-[#a46bff]/40" hotClass="bg-[#ffb21e]" labelClass="text-white/70" />
            </div>
          </motion.article>
        </BlurFade>

        {latestMoments.length && latest ? (
          <BlurFade delay={0.56} className="md:col-span-2">
            <article className={sticker("ink", "h-full p-5")}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl tracking-wide">WHAT THE CAMERA SAW</h2>
                <Link href={`/play/session?id=${encodeURIComponent(latest.id)}`} className="text-sm font-semibold text-[#9cff5a] hover:underline">
                  All moments
                </Link>
              </div>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {latestMoments.map((moment, index) => (
                  <li key={moment.id}>
                    <MomentCard moment={moment} href={`/play/session?id=${encodeURIComponent(latest.id)}`} delay={0.6 + index * 0.08} />
                  </li>
                ))}
              </ul>
            </article>
          </BlurFade>
        ) : null}

        <BlurFade delay={0.6} className="md:col-span-4">
          <article className={sticker("ink", "p-5")}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-wide">GARDEN STICKER BOOK</h2>
              <span className="text-sm text-white/60">
                {unlocked} of {COLLECTION.length} friends met · one for each walk home
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
                      <img src={asset(item.src)} alt="" className={cn("size-14 object-contain", !got && "opacity-25 brightness-0 invert")} />
                    </span>
                    <span className="text-xs font-semibold text-white/80">{got ? item.name : "???"}</span>
                  </motion.li>
                )
              })}
            </ul>
          </article>
        </BlurFade>

        <BlurFade delay={0.66} className="md:col-span-4">
          <article className={sticker("ink", "p-5")}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl tracking-wide">LAST WALKS</h2>
              <Link href="/activity" className="text-sm font-semibold text-[#9cff5a] hover:underline">
                View all
              </Link>
            </div>
            {walks.length ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {walks.slice(0, 3).map((walk) => (
                  <motion.li key={walk.id} whileHover={{ y: -3 }}>
                    <Link
                      href={walk.openable ? `/play/session?id=${encodeURIComponent(walk.id)}` : "/activity"}
                      className="group flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 transition hover:bg-[#9cff5a]/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset(walk.home ? "/art/house.png" : "/art/pod.png")} alt="" className="size-10 object-contain transition group-hover:-rotate-12 group-hover:scale-110" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{walk.home ? "Gus got home" : "A short walk"}</span>
                        <span className="block text-sm text-white/60">
                          {whenLabel(walk.at, now)} {clockLabel(walk.at)} · {durationLabel(walk.seconds)}
                        </span>
                      </span>
                      <span className="font-display text-3xl text-[#9cff5a] tabular-nums">{walk.flowersPct !== null ? `${walk.flowersPct}%` : "—"}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/60">{loading ? "Looking for your walks…" : "No walks yet."}</p>
            )}
          </article>
        </BlurFade>
      </div>
    </div>
  )
}
