"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import confetti from "canvas-confetti"
import { motion, useReducedMotion } from "motion/react"
import { ArrowLeft, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatLevel } from "@/lib/format"
import { GardenStage } from "@/components/garden-stage"
import { levelById } from "@/lib/levels"
import {
  MIN_SCORED_STEPS,
  STEP_MS,
  WAVE_COUNT,
  WAVE_STEPS,
  chipLights,
  createLive,
  summarize,
  takeStep,
  tick,
} from "@/lib/scoring"
import { GAME_BUTTON, ZOMBIE, sticker } from "@/lib/sticker"
import { useStride } from "@/lib/store"
import type { Foot, LiveState, Outcome, RoundMetrics } from "@/lib/types"
import { cn } from "cn"

type Phase = "brief" | "count" | "live" | "results"

type ResultState = {
  outcome: Outcome
  metrics: RoundMetrics
  partial: boolean
}

export function SessionView() {
  const params = useSearchParams()
  const requested = Number(params.get("level"))
  const { state, derived, completeSession } = useStride()
  const level = Number.isFinite(requested) && requested > 0 ? levelById(requested) : derived.prescribed
  const known = Number.isFinite(requested) ? requested === level.id : true
  const locked = level.id > state.unlockedThrough
  const [phase, setPhase] = useState<Phase>("brief")
  const [count, setCount] = useState(3)
  const [live, setLive] = useState<LiveState | null>(null)
  const [paused, setPaused] = useState(false)
  const [sound, setSound] = useState(false)
  const [earlyNote, setEarlyNote] = useState("")
  const [result, setResult] = useState<ResultState | null>(null)
  const pausedRef = useRef(false)
  const savedRef = useRef(false)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (phase !== "count") return
    const timer = window.setTimeout(() => {
      if (count <= 1) {
        setLive(createLive(performance.now()))
        setPhase("live")
        setCount(0)
        return
      }
      setCount(count - 1)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [phase, count])

  useEffect(() => {
    if (phase !== "live") return
    const timer = window.setInterval(() => {
      if (pausedRef.current) return
      setLive((current) => (current && !current.finished ? tick(current, performance.now()) : current))
    }, 100)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== "live" || !sound || paused) return
    const audio = new AudioContext()
    let next = audio.currentTime + 0.15
    const timer = window.setInterval(() => {
      while (next < audio.currentTime + 0.18) {
        const osc = audio.createOscillator()
        const gain = audio.createGain()
        osc.type = "sine"
        osc.frequency.value = 740
        gain.gain.setValueAtTime(0.0001, next)
        gain.gain.exponentialRampToValueAtTime(0.045, next + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, next + 0.07)
        osc.connect(gain)
        gain.connect(audio.destination)
        osc.start(next)
        osc.stop(next + 0.08)
        next += STEP_MS / 1000
      }
    }, 50)
    return () => {
      window.clearInterval(timer)
      void audio.close()
    }
  }, [phase, sound, paused])

  useEffect(() => {
    if (phase !== "live") return
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) {
        event.preventDefault()
      }
      if (pausedRef.current) return
      const now = performance.now()
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        setLive((current) => (current && !current.finished ? takeStep(current, "L", now) : current))
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        setLive((current) => (current && !current.finished ? takeStep(current, "R", now) : current))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase])

  function step(foot: Foot) {
    setLive((current) => (current && !current.finished ? takeStep(current, foot, performance.now()) : current))
  }

  const finish = useCallback((source: LiveState, partial: boolean) => {
    const metrics = summarize(source)
    const elapsed = Math.max(1, Math.round(source.elapsed / 60000))
    const outcome = completeSession({
      levelId: level.id,
      levelName: level.name,
      durationMin: elapsed,
      walkingScore: metrics.walkingScore,
      pace: metrics.pace,
      symmetry: metrics.symmetry,
      steps: metrics.steps,
      source: "form-round",
    })
    setResult({ outcome, metrics, partial })
    setPaused(false)
    setPhase("results")
  }, [completeSession, level.id, level.name])

  useEffect(() => {
    if (phase !== "live" || !live?.finished) return
    const snapshot = live
    const timer = window.setTimeout(() => {
      if (savedRef.current) return
      savedRef.current = true
      finish(snapshot, false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [finish, live, phase])

  function endEarly() {
    if (!live) return
    if (live.events.length < MIN_SCORED_STEPS) {
      setEarlyNote(`Take at least ${MIN_SCORED_STEPS} steps before this round can be scored.`)
      return
    }
    savedRef.current = true
    finish(live, true)
  }

  if (!known) {
    return (
      <CenterNote
        title="That stage is not on the path."
        body="The ten stages are numbered 1 through 10."
      />
    )
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070b10] text-white">
      <GardenStage />
      <div className="absolute inset-0 bg-[#070b10]/40" />
      <div className="relative z-30 mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/play" className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
            <ArrowLeft className="size-4" />
            Path
          </Link>
          {phase === "live" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSound((value) => !value)}
                className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
                aria-label={sound ? "Mute metronome" : "Play metronome"}
                aria-pressed={sound}
              >
                {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setPaused(true)}
                className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
                aria-label="Pause"
              >
                <Pause className="size-4" />
              </button>
            </div>
          ) : (
            <span className="font-display rounded-full border-2 border-[#9cff5a] bg-[#12261a]/80 px-3 py-1 text-sm tracking-wide text-[#9cff5a]">
              LEVEL {formatLevel(level.id)}
            </span>
          )}
        </div>

        {phase === "brief" ? (
          <Brief
            levelName={level.name}
            minutes={level.minutes}
            summary={level.summary}
            focus={level.focus}
            locked={locked}
            sensorsReady={state.sensors.camera && state.sensors.trackpad}
            onStart={() => {
              savedRef.current = false
              setCount(3)
              setPhase("count")
            }}
          />
        ) : null}

        {phase === "count" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-bold tracking-[0.2em] text-[#2de2c4]">FIND YOUR CADENCE</p>
            <motion.p
              key={count}
              className="font-display text-outline mt-3 text-[10rem] leading-none text-[#ffd76a] tabular-nums"
              initial={{ scale: 2.2, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
            >
              {count}
            </motion.p>
          </div>
        ) : null}

        {phase === "live" && live ? (
          <LiveHud
            live={live}
            levelName={level.name}
            paused={paused}
            earlyNote={earlyNote}
            onStep={step}
            onResume={() => {
              setPaused(false)
              setEarlyNote("")
            }}
            onEnd={endEarly}
          />
        ) : null}

        {phase === "results" && result ? (
          <Results levelName={level.name} result={result} onAgain={() => {
            setResult(null)
            setLive(null)
            setEarlyNote("")
            setPhase("brief")
          }} />
        ) : null}
      </div>
    </div>
  )
}

function Brief({
  levelName,
  minutes,
  summary,
  focus,
  locked,
  sensorsReady,
  onStart,
}: {
  levelName: string
  minutes: number
  summary: string
  focus: readonly string[]
  locked: boolean
  sensorsReady: boolean
  onStart: () => void
}) {
  return (
    <div className="flex flex-1 items-end py-6 sm:items-center">
      <motion.section
        initial={{ opacity: 0, y: 30, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className={sticker("ink", "w-full bg-[#0d171c]/95 p-6 backdrop-blur sm:p-8")}
      >
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">FORM ROUND · ABOUT A MINUTE</p>
        <h1 className="font-display text-outline mt-2 text-4xl leading-none tracking-wide text-[#ffd76a] sm:text-5xl">{levelName.toUpperCase()}</h1>
        <p className="mt-3 text-[15px] leading-6 text-white/80">{summary}</p>
        <p className="mt-3 text-sm leading-6 text-white/65">
          On the projected floor this goal is {minutes} minutes of the same plant walk. The floor scores pace and symmetry.
          This round uses that goal&apos;s cues. Two waves, {WAVE_STEPS} steps each.
        </p>
        <ol className="mt-4 flex flex-wrap gap-2">
          {focus.map((item, index) => (
            <li key={item} className="rounded-full border-2 border-[#9cff5a]/60 bg-[#12261a] px-3 py-1 text-sm font-semibold text-[#9cff5a]">
              {index + 1}. {item}
            </li>
          ))}
        </ol>
        <ul className="mt-4 grid gap-1 text-sm text-white/60">
          <li>Left foot: A or the left arrow. Right foot: D or the right arrow.</li>
          <li>Keep the same time between steps, and switch feet each time.</li>
          <li>Stop if anything hurts. A form round is not worth a sore knee.</li>
        </ul>
        {locked ? (
          <p className={sticker("amber", "mt-4 rounded-2xl px-4 py-3 text-sm text-white/85 shadow-none")}>
            This goal is still locked. Score 80 on the current goal of your plan to open it.
          </p>
        ) : null}
        {!sensorsReady ? (
          <p className={sticker("amber", "mt-4 rounded-2xl px-4 py-3 text-sm text-white/85 shadow-none")}>
            The camera and trackpad both need to answer before a scored walk. Open the movement kit from the path and run a connection check.
          </p>
        ) : null}
        <button type="button" className={cn(GAME_BUTTON, "mt-6 disabled:opacity-40")} disabled={locked || !sensorsReady} onClick={onStart}>
          <Play className="size-5 fill-current" /> START FORM ROUND
        </button>
      </motion.section>
    </div>
  )
}

function LiveHud({
  live,
  levelName,
  paused,
  earlyNote,
  onStep,
  onResume,
  onEnd,
}: {
  live: LiveState
  levelName: string
  paused: boolean
  earlyNote: string
  onStep: (foot: Foot) => void
  onResume: () => void
  onEnd: () => void
}) {
  const lights = chipLights(live)
  const seconds = Math.max(0, Math.round(live.elapsed / 1000))
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  const chips = [
    { label: "Steady pace", on: lights.pace },
    { label: "Even stride", on: lights.stride },
  ]

  return (
    <div className="flex flex-1 flex-col justify-between pt-6">
      <div>
        <p className="text-sm text-white/75">{levelName}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-outline text-5xl tracking-wide text-[#ffd76a]">
            WAVE {live.wave} OF {WAVE_COUNT}
          </h1>
          <p className="font-display text-3xl tabular-nums text-white">{clock}</p>
        </div>
        <p className="mt-2 text-sm text-white/80" aria-live="polite">
          {live.lastCue}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                chip.on ? "border-2 border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]" : "border-2 border-white/15 bg-white/10 text-white/80",
              )}
            >
              {chip.label}
            </span>
          ))}
        </div>
        <div className="mt-4 max-w-sm">
          <div className="flex justify-between text-xs text-white/75">
            <span>Wave pressure</span>
            <span>{Math.round(live.pressure)}</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-[#0b1a14] bg-[#14242a]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffb21e,#ff3d8b)] transition-[width] duration-300" style={{ width: `${live.pressure}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/70">
            Step {Math.min(live.stepsThisWave + 1, WAVE_STEPS)} of {WAVE_STEPS}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <FootButton label="Left foot" hint="A" active={live.expected === "L"} onClick={() => onStep("L")} />
          <FootButton label="Right foot" hint="D" active={live.expected === "R"} onClick={() => onStep("R")} />
        </div>
      </div>

      {paused ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#0c2418]/70 px-4 backdrop-blur-sm">
          <div className={sticker("amber", "w-full max-w-sm p-6")}>
            <h2 className="font-display text-outline text-4xl tracking-wide text-[#ffd76a]">PAUSED</h2>
            <p className="mt-2 text-sm leading-6 text-white/75">
              The round is stopped. End it once you have at least {MIN_SCORED_STEPS} steps, or leave without a score.
            </p>
            {earlyNote ? <p className="mt-3 text-sm text-destructive">{earlyNote}</p> : null}
            <div className="mt-5 grid gap-2">
              <button type="button" className={cn(GAME_BUTTON, "justify-center")} onClick={onResume}>
                <Play className="size-5 fill-current" /> RESUME
              </button>
              <Button type="button" variant="outline" className="h-11 rounded-full" onClick={onEnd}>
                End and score
              </Button>
              <Link href="/play" className="py-2 text-center text-sm font-semibold text-white/60 hover:text-white">
                Leave without scoring
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FootButton({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-20 rounded-[24px] border text-left transition",
        active
          ? "step-pulse border-[2.5px] border-[#0b1a14] bg-[#ffb21e] text-[#0b1a14] shadow-[0_5px_0_#a8690b]"
          : "border-[2.5px] border-white/20 bg-white/10 text-white hover:bg-white/20",
      )}
    >
      <span className="block px-4">
        <span className="font-display block text-2xl tracking-wide">{label}</span>
        <span className={cn("text-xs", active ? "text-[#0b1a14]/70" : "text-white/70")}>{hint}</span>
      </span>
    </button>
  )
}

function Results({
  levelName,
  result,
  onAgain,
}: {
  levelName: string
  result: ResultState
  onAgain: () => void
}) {
  const { outcome, metrics, partial } = result
  const nextName = outcome.openedLevelId ? levelById(outcome.openedLevelId).name : null
  const reduce = useReducedMotion()
  const great = !partial && metrics.walkingScore >= 80

  useEffect(() => {
    if (reduce) return
    const colors = ["#9cff5a", "#ffb21e", "#ff3d8b", "#a46bff", "#2de2c4", "#ffd76a"]
    const burst = (x: number, angle: number) =>
      confetti({ particleCount: great ? 90 : 40, spread: 70, angle, startVelocity: 48, origin: { x, y: 0.75 }, colors, disableForReducedMotion: true })
    burst(0.15, 60)
    burst(0.85, 120)
    const late = window.setTimeout(() => great && confetti({ particleCount: 120, spread: 120, origin: { y: 0.35 }, colors, disableForReducedMotion: true }), 450)
    return () => window.clearTimeout(late)
  }, [great, reduce])

  return (
    <div className="flex flex-1 items-end py-6 sm:items-center">
      <motion.section
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className={sticker(great ? "lime" : "amber", "relative w-full overflow-visible bg-[#0d171c]/95 p-6 backdrop-blur sm:p-8")}
      >
        { }
        <motion.img
          src={great ? ZOMBIE.cheer : ZOMBIE.idle}
          alt=""
          className="absolute -top-28 right-4 w-32 drop-shadow-[0_8px_14px_rgba(0,0,0,0.6)] sm:-top-36 sm:w-40"
          initial={{ y: 60, opacity: 0, rotate: -10 }}
          animate={{ y: [60, -18, 0, -10, 0], opacity: 1, rotate: [-10, 6, 0] }}
          transition={{ duration: 1.1, delay: 0.25 }}
        />
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">
          {partial ? "FORM ROUND ENDED EARLY" : great ? "HOME BEFORE SUNRISE!" : "FORM ROUND COMPLETE"}
        </p>
        <h1 className="font-display text-outline mt-1 text-7xl leading-none tabular-nums text-[#ffd76a]">
          <NumberTicker value={metrics.walkingScore} delay={0.3} />
          <span className="ml-2 text-2xl text-white/60">/100</span>
        </h1>
        <p className="mt-1 text-sm text-white/65">{levelName}</p>
        <dl className="mt-5 grid grid-cols-2 gap-2 text-center">
          <Mini label="Pace" value={metrics.pace} />
          <Mini label="Symmetry" value={metrics.symmetry} />
        </dl>
        <motion.p
          className="mt-4 rounded-2xl rounded-tl-sm border-[2.5px] border-[#0b1a14] bg-white px-4 py-3 text-[15px] font-medium leading-6 text-[#0b1a14] shadow-[3px_3px_0_#9c2457]"
          initial={{ opacity: 0, scale: 0.9, originX: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.8 }}
        >
          {outcome.session.feedback}
        </motion.p>
        <ul className="mt-4 grid gap-1.5 text-sm text-white/80">
          <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}>
            <span className="font-display text-lg text-[#9cff5a]">+{outcome.xpGain} XP</span> · streak {outcome.streak}{" "}
            {outcome.streak === 1 ? "night" : "nights"}
          </motion.li>
          {outcome.beatStreak ? <li>You beat your best streak.</li> : null}
          {outcome.playerLevelAfter > outcome.playerLevelBefore ? <li>You reached player level {outcome.playerLevelAfter}.</li> : null}
          {nextName ? (
            <li>
              Level {outcome.openedLevelId} is open. {nextName} is on your path.
            </li>
          ) : null}
          {!nextName && metrics.walkingScore < 80 ? <li>An 80 on the planned garden opens the next one.</li> : null}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/therapist" className={GAME_BUTTON}>
            READ MAYA&apos;S NOTE
          </Link>
          <Link href="/progress" className="inline-flex h-12 items-center rounded-2xl border-[2.5px] border-[#2c4639] px-4 text-sm font-medium text-white transition hover:bg-white/10">
            Review progress
          </Link>
          <Button type="button" variant="outline" className="h-12 rounded-2xl border-[2.5px] border-[#2c4639] bg-transparent px-4 text-white hover:bg-white/10" onClick={onAgain}>
            Walk it again
          </Button>
        </div>
      </motion.section>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-3">
      <dt className="text-[11px] font-bold tracking-[0.12em] text-[#2de2c4]">{label.toUpperCase()}</dt>
      <dd className="font-display text-outline mt-1 text-4xl tabular-nums text-[#9cff5a]">
        <NumberTicker value={value} delay={0.6} />
      </dd>
    </div>
  )
}

function CenterNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#070b10] px-6 text-white">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl tracking-wide text-[#ffd76a]">{title}</h1>
        <p className="mt-2 text-sm text-white/75">{body}</p>
        <Link href="/play" className={cn(GAME_BUTTON, "mt-6")}>
          Back to the path
        </Link>
      </div>
    </div>
  )
}
