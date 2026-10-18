"use client"

/** One walk in full: the plain words, Maya's note, the numbers, the moments in pictures, the cadence through the
 * walk, the side camera's measurements and the review itself. */

import Link from "next/link"
import { useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "motion/react"
import { ArrowLeft, Play } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { BlurFade } from "@/components/ui/blur-fade"
import { TimelineChart } from "@/components/timeline-chart"
import { DemoTag, EmptyNote, LEFT, RIGHT, MomentCard, NumberGrid, ReviewChip, WalkWords, sidesLabel, walkFigures, type Figure } from "@/components/walk-bits"
import { api, useMounted, usePoll, type Finding } from "@/lib/game"
import { useGame } from "@/lib/game-data"
import { GAME_BUTTON, MAYA_AVATAR, sticker } from "@/lib/sticker"
import { clockLabel, durationLabel, mayaLine, reviewOf, walkFromSession, whenLabel, type Walk } from "@/lib/walks"
import { cn } from "cn"

const SIDE_NAME = { L: "left", R: "right", both: "both sides", none: "" } as const

export function SessionView() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const { walks, loading, player } = useGame()
  const mounted = useMounted()
  const listed = walks.find((walk) => walk.id === id) ?? null
  const real = Boolean(id) && !(listed?.demo ?? false)
  const loadSession = useCallback(() => api.session(id), [id])
  const loadMoments = useCallback(() => api.moments(id), [id])
  const full = usePoll(loadSession, 15000, real, id)
  const moments = usePoll(loadMoments, 15000, real, id)
  const walk: Walk | null = full.data ? walkFromSession(full.data) : listed
  const now = new Date()

  if (!id) {
    return <Missing title="Which walk?" body="Open a walk from the sessions list." />
  }
  if (!walk) {
    if (loading || (real && !full.polled)) {
      return (
        <div className="grid gap-4" aria-busy="true">
          <div className="h-24 animate-pulse rounded-[26px] border-[2.5px] border-[#1b2f27] bg-[#0d171c] motion-reduce:animate-none" />
          <div className="h-64 animate-pulse rounded-[26px] border-[2.5px] border-[#1b2f27] bg-[#0d171c] motion-reduce:animate-none" />
        </div>
      )
    }
    return <Missing title="That walk is not on record." body="It may belong to another player, or the server was restarted with a fresh store." />
  }

  const review = reviewOf(walk)
  const maya = mayaLine(walk)
  const list = (moments.data ?? []).slice().reverse()
  const extras: Figure[] = [
    { label: "Time on the pad", value: durationLabel(walk.seconds), tone: "white" },
    { label: "High steps L / R", value: sidesLabel(walk.highLiftCm, 1), unit: "cm", tone: "violet", hint: walk.shoeMode ? "forward swing" : "lift" },
    { label: "Steps L / R", value: sidesLabel(walk.stepsByFoot), tone: "white" },
    {
      label: "Flowers L / R lane",
      value: walk.lanes && (walk.lanes.L[1] || walk.lanes.R[1]) ? `${walk.lanes.L[0]}/${walk.lanes.L[1]} · ${walk.lanes.R[0]}/${walk.lanes.R[1]}` : null,
      tone: "lime",
      hint: "hit / judged",
    },
    { label: "Bouquets", value: walk.bouquets, tone: "rose" },
    { label: "Score", value: walk.score, unit: "pts", tone: "amber" },
  ]
  const gaitFigures: Figure[] = [
    { label: "Knee bend L / R", value: sidesLabel(walk.kneeDeg), unit: "°", tone: "violet", hint: "peak, in swing" },
    { label: "Stride time L / R", value: sidesLabel(walk.strideS, 2), unit: "s", tone: "white" },
    { label: "Stride variation L / R", value: sidesLabel(walk.strideCv), unit: "%", tone: "amber", hint: "lower is steadier" },
    { label: "Toe lift L / R", value: sidesLabel(walk.toeLiftCm, 1), unit: "cm", tone: "teal" },
    { label: "Heel first L / R", value: sidesLabel(walk.heelFirstPct), unit: "%", tone: "white" },
    { label: "Cadence, camera", value: walk.sideCadence !== null ? Math.round(walk.sideCadence) : null, unit: "/min", tone: "amber" },
    { label: "Camera frames", value: walk.cameraFps !== null ? walk.cameraFps.toFixed(1) : null, unit: "/s", tone: "white" },
  ]
  const hasGait = gaitFigures.some((figure) => figure.value !== null)
  const quality = walk.review?.dataQuality ?? null

  return (
    <div>
      <Link href="/activity" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
        <ArrowLeft className="size-4" /> Sessions
      </Link>
      <PageHeader
        eyebrow={mounted ? `WALK · ${whenLabel(walk.at, now).toUpperCase()} ${clockLabel(walk.at).toUpperCase()} · ${durationLabel(walk.seconds).toUpperCase()} · ${player.toUpperCase()}` : "WALK"}
        title={walk.home ? "Gus got home" : "A short walk"}
        subtitle={review?.overview ?? walk.note ?? undefined}
        extra={
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <ReviewChip walk={walk} />
            {walk.demo ? <DemoTag /> : null}
            {walk.verified ? <span className="rounded-full border-2 border-white/15 px-2.5 py-0.5 text-xs font-semibold text-white/60">verified walk</span> : null}
            {walk.rewarded ? <span className="rounded-full border-2 border-[#ffb21e]/60 bg-[#2a1f0e] px-2.5 py-0.5 text-xs font-semibold text-[#ffd76a]">reward unlocked</span> : null}
          </p>
        }
      />

      <div className="grid gap-5">
        <BlurFade delay={0.1}>
          <section className={sticker("ink", "p-5")}>
            <WalkWords walk={walk} moments={moments.data ?? []} />
            {maya ? (
              <div className="mt-4 flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MAYA_AVATAR} alt="" className="mt-1 size-10 shrink-0 rounded-full bg-[#ffd6e7] object-contain ring-2 ring-[#ff3d8b]" />
                <motion.p
                  className="rounded-2xl rounded-tl-sm border-[2.5px] border-[#0b1a14] bg-white px-4 py-3 text-[15px] font-medium leading-6 text-[#0b1a14] shadow-[3px_3px_0_#9c2457]"
                  initial={{ opacity: 0, scale: 0.9, originX: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.5 }}
                >
                  {maya}
                </motion.p>
              </div>
            ) : null}
          </section>
        </BlurFade>

        <BlurFade delay={0.16}>
          <section className={sticker("ink", "p-5")}>
            <h2 className="font-display text-2xl tracking-wide">THE NUMBERS</h2>
            <NumberGrid figures={[...walkFigures(walk), ...extras]} className="mt-3 sm:grid-cols-4" delay={0.2} />
          </section>
        </BlurFade>

        <BlurFade delay={0.22}>
          <section className={sticker("ink", "p-5")}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-wide">MOMENTS</h2>
              <p className="text-sm text-white/60">What the side camera saw, in pictures, with the sticks drawn and a plain explanation.</p>
            </div>
            {list.length ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((moment, index) => (
                  <li key={moment.id}>
                    <MomentCard moment={moment} delay={Math.min(index, 8) * 0.05} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-white/60">
                {walk.demo
                  ? "Demo walks have no camera moments."
                  : moments.polled
                    ? "No moments were kept for this walk. With the phone at the side of the pad, the next walk shows them here."
                    : "Looking for the moments…"}
              </p>
            )}
          </section>
        </BlurFade>

        {walk.timeline.length >= 2 ? (
          <BlurFade delay={0.28}>
            <section className={sticker("ink", "p-5")}>
              <h2 className="font-display text-2xl tracking-wide">CADENCE THROUGH THE WALK</h2>
              <p className="text-sm text-white/60">Steps a minute, sampled every 15 seconds, through the acts of the walk.</p>
              <TimelineChart points={walk.timeline} segments={walk.segments} seconds={walk.seconds} />
            </section>
          </BlurFade>
        ) : null}

        {hasGait || quality ? (
          <BlurFade delay={0.34}>
            <section className={sticker("violet", "p-5")}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl tracking-wide">THE SIDE CAMERA</h2>
                {walk.nearSide ? (
                  <p className="text-sm text-white/65">
                    The <span className="font-semibold" style={{ color: walk.nearSide === "L" ? LEFT : RIGHT }}>{SIDE_NAME[walk.nearSide]}</span> leg was nearer the camera and is measured best.
                  </p>
                ) : null}
              </div>
              {hasGait ? <NumberGrid figures={gaitFigures} className="mt-3 sm:grid-cols-4" delay={0.3} /> : null}
              {quality ? (
                <div className="mt-4 rounded-2xl bg-black/25 p-4">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#c9a8ff]">DATA QUALITY · {quality.level.toUpperCase()}</p>
                  <ul className="mt-1.5 grid gap-1 text-sm leading-5 text-white/75">
                    {quality.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </BlurFade>
        ) : null}

        <BlurFade delay={0.4}>
          <ReviewSection walk={walk} />
        </BlurFade>

        <div className="flex flex-wrap gap-3">
          <Link href="/play" className={GAME_BUTTON}>
            <Play className="size-5 fill-current" /> LIVE WALK
          </Link>
          <Link href="/therapist" className="inline-flex h-12 items-center rounded-2xl border-[2.5px] border-[#2c4639] px-4 text-sm font-medium text-white transition hover:bg-white/10">
            Ask Maya about this walk
          </Link>
        </div>
      </div>
    </div>
  )
}

function ReviewSection({ walk }: { walk: Walk }) {
  const review = reviewOf(walk)
  const state = walk.review
  if (!state) {
    return (
      <section className={sticker("rose", "p-5")}>
        <h2 className="font-display text-2xl tracking-wide">MAYA&apos;S REVIEW</h2>
        <p className="mt-2 text-sm leading-6 text-white/75">
          {walk.demo ? "Demo walks carry the coach's note only." : "No side camera on this walk, so Maya wrote the coach's note from the game alone."}
        </p>
        {walk.note ? <p className="mt-3 rounded-2xl bg-black/25 px-4 py-3 text-[15px] leading-6 text-white/90">{walk.note}</p> : null}
      </section>
    )
  }
  if (!review) {
    return (
      <section className={sticker("rose", "p-5")}>
        <h2 className="font-display text-2xl tracking-wide">MAYA&apos;S REVIEW</h2>
        <p className="mt-2 text-sm leading-6 text-white/75">
          {state.status === "waiting" && "Waiting for the side camera to send the walk. This page looks again by itself."}
          {state.status === "reviewing" && "Maya is reading the numbers now. This page looks again by itself."}
          {state.status === "failed" && `The review could not finish${state.reason ? `: ${state.reason}` : ""}.`}
        </p>
        {walk.note ? <p className="mt-3 rounded-2xl bg-black/25 px-4 py-3 text-[15px] leading-6 text-white/90">{walk.note}</p> : null}
      </section>
    )
  }
  const next = review.nextSession ?? { liftCm: null, spacingCm: null, minCadence: null, why: "" }
  const changes = [
    ["liftCm", "lift target", "cm"],
    ["spacingCm", "flower spacing", "cm"],
    ["minCadence", "minimum pace", "steps/min"],
  ].filter(([key]) => typeof next[key as keyof typeof next] === "number")
  return (
    <section className={sticker("rose", "p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl tracking-wide">MAYA&apos;S REVIEW</h2>
        <p className="text-xs text-white/55">
          {state.source === "gemini" ? `Gemini${state.model ? ` · ${state.model}` : ""}` : "rules on this computer"}
          {state.filledByRules?.length ? ` · ${state.filledByRules.length} part${state.filledByRules.length === 1 ? "" : "s"} by the rules` : ""}
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#9cff5a]">STRENGTHS</p>
          {review.strengths.length ? (
            <ul className="mt-1.5 grid gap-1.5 text-sm leading-5 text-white/85">
              {review.strengths.map((item) => (
                <li key={item.text}>{item.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-white/60">Nothing singled out this time.</p>
          )}
        </div>
        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">FINDINGS</p>
          {review.findings.length ? (
            <ul className="mt-1.5 grid gap-1.5 text-sm leading-5 text-white/85">
              {review.findings.map((item: Finding) => (
                <li key={item.text}>
                  <span className="font-semibold text-[#ffd76a]">
                    {item.area}
                    {item.side !== "none" ? `, ${SIDE_NAME[item.side]}` : ""}
                  </span>{" "}
                  <span className="text-white/50">({item.confidence})</span> {item.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-white/60">No findings: the walk looked steady.</p>
          )}
        </div>
        {review.gameVsGait.length ? (
          <Block label="THE GAME AND THE WALK" items={review.gameVsGait.map((item) => item.text)} />
        ) : null}
        {review.actComparison ? <Block label="WALKING, FLOWERS, SEEDS" text={review.actComparison} /> : null}
        {review.trend ? <Block label="TREND" text={review.trend} /> : null}
        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">CUES FOR NEXT TIME</p>
          <ul className="mt-1.5 grid gap-1.5">
            {review.cues.map((cue, index) => (
              <li key={cue} className="flex items-center gap-2 text-sm text-white/90">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#9cff5a] text-xs font-bold text-[#0b1a14]">{index + 1}</span>
                {cue}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#c9a8ff]">NEXT SESSION</p>
          <p className="mt-1.5 text-sm leading-5 text-white/85">
            {changes.length
              ? `Suggested: ${changes.map(([key, label, unit]) => `${label} ${next[key as keyof typeof next]} ${unit}`).join(", ")}.`
              : "No change to the settings."}{" "}
            {next.why}
          </p>
          {changes.length ? (
            <Link href="/therapist#settings" className="mt-2 inline-block text-sm font-semibold text-[#c9a8ff] hover:underline">
              Apply in the therapist settings
            </Link>
          ) : null}
        </div>
        <Block label="FOR THE PARENT" text={review.parentNote} />
        <Block label="FILMING THE NEXT WALK" text={review.nextRecording} />
      </div>
      <details className="mt-4 rounded-2xl bg-black/25 p-4">
        <summary className="cursor-pointer text-[11px] font-bold tracking-[0.16em] text-white/60">FOR THE THERAPIST · NUMBERS AND IDS</summary>
        <p className="mt-2 font-mono text-xs leading-5 text-white/75">{review.therapistNote}</p>
        {state.withheld?.length ? (
          <ul className="mt-2 grid gap-1 text-xs leading-5 text-white/55">
            {state.withheld.map((item) => (
              <li key={item.id}>
                {item.id}: {item.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  )
}

function Block({ label, text, items }: { label: string; text?: string; items?: string[] }) {
  return (
    <div className="rounded-2xl bg-black/25 p-4">
      <p className="text-[11px] font-bold tracking-[0.16em] text-white/60">{label}</p>
      {text ? <p className="mt-1.5 text-sm leading-5 text-white/85">{text}</p> : null}
      {items ? (
        <ul className="mt-1.5 grid gap-1.5 text-sm leading-5 text-white/85">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Missing({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10">
      <EmptyNote title={title.toUpperCase()} body={body} />
      <div className="mt-4 text-center">
        <Link href="/activity" className={cn(GAME_BUTTON)}>
          <ArrowLeft className="size-5" /> SESSIONS
        </Link>
      </div>
    </div>
  )
}
