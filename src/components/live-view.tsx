"use client"

/** Live walk: connect the phone, both cameras with the skeleton on the side picture, the numbers that matter
 * right now, the coach's latest line and the moments as they arrive. */

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, MessageCircle } from "lucide-react"
import { CameraTile } from "@/components/camera-tile"
import { PageHeader } from "@/components/page-header"
import { PhoneConnect } from "@/components/phone-connect"
import { PoseCanvas } from "@/components/pose-canvas"
import { BlurFade } from "@/components/ui/blur-fade"
import { LEFT, RIGHT, MomentCard, NumberGrid, type Figure } from "@/components/walk-bits"
import { useGame } from "@/lib/game-data"
import { useLiveWalk } from "@/lib/live"
import { api, usePoll } from "@/lib/game"
import { MAYA_AVATAR, sticker } from "@/lib/sticker"
import { clock } from "@/lib/walks"
import { cn } from "cn"

export function LiveView() {
  const { player, latest, online } = useGame()
  const live = useLiveWalk(player)
  const sideKnee = live.pose?.knee ?? null
  const kneeL = sideKnee?.L ?? live.gait?.kneeDeg.L ?? null
  const kneeR = sideKnee?.R ?? live.gait?.kneeDeg.R ?? null
  const cadence = live.pace?.cadence ?? live.gait?.cadence ?? null
  const figures: Figure[] = [
    { label: "Cadence", value: cadence !== null ? Math.round(cadence) : "–", unit: "/min", tone: "amber", hint: live.pace ? "the game" : live.gait ? "side camera" : "waiting" },
    { label: "Even L / R", value: live.gait?.evenPct ?? "–", unit: live.gait?.evenPct !== undefined && live.gait?.evenPct !== null ? "%" : undefined, tone: "teal", hint: live.gait ? `side camera · ${live.gait.ageS} s ago` : "side camera" },
    { label: "Knee bend L / R", value: kneeL !== null || kneeR !== null ? `${kneeL !== null ? Math.round(kneeL) : "–"} / ${kneeR !== null ? Math.round(kneeR) : "–"}` : "–", unit: "°", tone: "violet", hint: live.pose ? "live skeleton" : "side camera" },
    { label: "Flowers this round", value: live.flowersRound ? `${live.flowersRound.hit} / ${live.flowersRound.n}` : "–", tone: "lime", hint: live.flowersRound?.round ? `round ${live.flowersRound.round}` : "hit / judged" },
    { label: "Steps", value: live.pace ? live.pace.steps : "–", tone: "white" },
    { label: "Form", value: live.pace ? live.pace.form : "–", unit: live.pace ? "%" : undefined, tone: "white", hint: "pace, both feet, evenness" },
  ]
  const lastWalkMoments = usePoll(
    () => (latest && !latest.demo && latest.openable ? api.moments(latest.id) : Promise.resolve([])),
    30000,
    !live.running && Boolean(latest),
    latest?.id ?? "",
  )
  const showLast = !live.running && live.moments.length === 0 && (lastWalkMoments.data?.length ?? 0) > 0
  const stateLine = live.running
    ? `${live.active?.player ?? player} is walking · ${clock(live.sinceS)} since the start`
    : online === false
      ? "The game server is not answering: start it, then this page fills itself."
      : "No game running. The game opens a session when the walk starts; the cameras show up here as soon as they send pictures."

  return (
    <div>
      <PageHeader
        eyebrow={`LIVE WALK · ${player.toUpperCase()}`}
        title="Live walk"
        subtitle={stateLine}
        extra={
          live.running ? (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-[#0b1a14] bg-[#9cff5a] px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#0b1a14]">
              <span className="size-2 rounded-full bg-[#0b1a14] motion-safe:animate-pulse" /> WALKING
            </span>
          ) : null
        }
      />

      <div className="grid gap-5">
        <BlurFade delay={0.05}>
          <PhoneConnect sideLive={live.sideLive} rate={live.sideRate} rateIsPreview={live.sideRateIsPreview} pose={live.pose} polled={live.socket || online !== null} />
        </BlurFade>

        <BlurFade delay={0.12}>
          <div className="grid gap-4 md:grid-cols-2">
            <CameraTile title="Top camera" waiting="Waiting for the camera over the pad (feet.py)." camera={live.cameras.top} kind="top" />
            <CameraTile
              title="Side camera"
              waiting="Waiting for the phone's pictures."
              camera={live.cameras.side}
              kind="side"
              overlay={(size) => <PoseCanvas pose={live.pose} width={size.width} height={size.height} />}
            />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-5 rounded-full" style={{ background: LEFT }} /> left leg</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-5 rounded-full" style={{ background: RIGHT }} /> right leg</span>
            <span>knee angles are written beside the knees</span>
            <span className={cn("ml-auto inline-flex items-center gap-1.5 font-semibold", live.socket ? "text-[#9cff5a]" : "text-[#ffd76a]")} role="status">
              <span className={cn("size-1.5 rounded-full", live.socket ? "bg-[#9cff5a]" : "bg-[#ffb21e] motion-safe:animate-pulse")} />
              {live.socket ? "event stream connected" : "event stream reconnecting"}
            </span>
          </p>
        </BlurFade>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <BlurFade delay={0.18}>
            <section className={sticker("ink", "h-full p-5")}>
              <h2 className="font-display text-2xl tracking-wide">RIGHT NOW</h2>
              <NumberGrid figures={figures} className="mt-3" delay={0.2} />
            </section>
          </BlurFade>
          <BlurFade delay={0.24}>
            <section className={sticker("amber", "flex h-full gap-4 p-5")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MAYA_AVATAR} alt="" className="size-16 shrink-0 rounded-full bg-[#ffd6e7] object-contain ring-[2.5px] ring-[#ff3d8b]" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">
                  <MessageCircle className="size-3.5" /> THE COACH SAYS
                </p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={live.cue?.say ?? "none"}
                    className={cn("font-display mt-2 leading-tight tracking-wide", live.cue ? "text-[1.9rem] text-[#ffd76a] sm:text-[2.3rem]" : "text-2xl text-white/50")}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    aria-live="polite"
                  >
                    {live.cue?.say ?? "Waiting for the walk"}
                  </motion.p>
                </AnimatePresence>
                {live.cue ? <p className="mt-2 text-xs text-white/55">{Math.max(0, Math.round(live.now / 1000 - live.cue.ts))} s ago</p> : null}
              </div>
            </section>
          </BlurFade>
        </div>

        <BlurFade delay={0.3}>
          <section className={sticker("ink", "p-5")}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl tracking-wide">MOMENTS</h2>
                <p className="text-sm text-white/60">
                  {showLast
                    ? "From your last walk: what the side camera saw, in pictures."
                    : "The side camera keeps a picture of each moment worth a look and explains it in plain words."}
                </p>
              </div>
              {showLast && latest ? (
                <Link href={`/play/session?id=${encodeURIComponent(latest.id)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#9cff5a] hover:underline">
                  Open that walk <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
            {live.moments.length || showLast ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {(live.moments.length ? live.moments : (lastWalkMoments.data ?? []).slice().reverse()).map((moment, index) => (
                    <li key={moment.id}>
                      <MomentCard moment={moment} delay={Math.min(index, 6) * 0.05} />
                    </li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="mt-4 grid place-items-center rounded-2xl border-[2.5px] border-dashed border-white/15 px-6 py-10 text-center">
                <p className="font-display text-xl tracking-wide text-[#ffd76a]">NOTHING TO SHOW YET</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-white/60">
                  Moments appear here while you walk: a knee that stayed low, an uneven step, or a step done just right.
                </p>
              </div>
            )}
          </section>
        </BlurFade>
      </div>
    </div>
  )
}
