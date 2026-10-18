"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Pause, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
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
            <span className="rounded-full bg-[#10281d]/70 px-3 py-1 text-[11px] font-semibold tracking-[0.14em]">
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
            <p className="text-sm font-semibold tracking-[0.16em] text-white/75">FIND YOUR CADENCE</p>
            <p className="mt-3 text-8xl font-semibold tabular-nums">{count}</p>
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
      <section className="w-full rounded-[28px] bg-white p-6 text-ink shadow-2xl sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">FORM ROUND · ABOUT A MINUTE</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{levelName}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p>
        <p className="mt-3 text-sm leading-6 text-[#2c4036]">
          In the clinic this goal is {minutes} minutes of the same plant walk, projected onto the trackpad. The floor scores pace and symmetry.
          This round uses that goal&apos;s cues. Two waves, {WAVE_STEPS} steps each.
        </p>
        <ol className="mt-4 flex flex-wrap gap-2">
          {focus.map((item, index) => (
            <li key={item} className="rounded-full bg-mint px-3 py-1 text-sm font-medium text-forest">
              {index + 1}. {item}
            </li>
          ))}
        </ol>
        <ul className="mt-4 grid gap-1 text-sm text-muted-foreground">
          <li>Left foot: A or the left arrow. Right foot: D or the right arrow.</li>
          <li>Keep the same time between steps, and switch feet each time.</li>
          <li>Stop if anything hurts. A form round is not worth a sore knee.</li>
        </ul>
        {locked ? (
          <p className="mt-4 rounded-2xl bg-peach px-4 py-3 text-sm text-[#6d533c]">
            This goal is still locked. Score 80 on the current goal of your plan to open it.
          </p>
        ) : null}
        {!sensorsReady ? (
          <p className="mt-4 rounded-2xl bg-peach px-4 py-3 text-sm text-[#6d533c]">
            The camera and trackpad both need to answer before a scored walk. Open the movement kit from the path and run a connection check.
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-6 h-11 rounded-full bg-orange px-5 text-white hover:bg-[#d9772b]"
          disabled={locked || !sensorsReady}
          onClick={onStart}
        >
          Start form round
        </Button>
      </section>
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
          <h1 className="text-3xl font-semibold tracking-tight">
            Wave {live.wave} of {WAVE_COUNT}
          </h1>
          <p className="text-2xl font-semibold tabular-nums">{clock}</p>
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
                chip.on ? "bg-white text-forest" : "bg-white/15 text-white/80",
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
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-orange" style={{ width: `${live.pressure}%` }} />
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
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-ink shadow-2xl">
            <h2 className="text-2xl font-semibold">Paused</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The round is stopped. End it once you have at least {MIN_SCORED_STEPS} steps, or leave without a score.
            </p>
            {earlyNote ? <p className="mt-3 text-sm text-destructive">{earlyNote}</p> : null}
            <div className="mt-5 grid gap-2">
              <Button type="button" className="h-11 rounded-full bg-orange text-white hover:bg-[#d9772b]" onClick={onResume}>
                Resume
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-full" onClick={onEnd}>
                End and score
              </Button>
              <Link href="/play" className="py-2 text-center text-sm font-semibold text-muted-foreground">
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
          ? "step-pulse border-orange bg-white text-ink"
          : "border-white/20 bg-white/15 text-white hover:bg-white/25",
      )}
    >
      <span className="block px-4">
        <span className="block text-lg font-semibold">{label}</span>
        <span className={cn("text-xs", active ? "text-muted-foreground" : "text-white/70")}>{hint}</span>
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
  return (
    <div className="flex flex-1 items-end py-6 sm:items-center">
      <section className="w-full rounded-[28px] bg-white p-6 text-ink shadow-2xl sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
          {partial ? "FORM ROUND ENDED EARLY" : "FORM ROUND COMPLETE"}
        </p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
          {metrics.walkingScore}
          <span className="ml-1 text-xl font-medium text-muted-foreground">/100</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{levelName}</p>
        <dl className="mt-5 grid grid-cols-2 gap-2 text-center">
          <Mini label="Pace" value={metrics.pace} />
          <Mini label="Symmetry" value={metrics.symmetry} />
        </dl>
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm leading-6">{outcome.session.feedback}</p>
        <ul className="mt-4 grid gap-1 text-sm text-[#2c4036]">
          <li>+{outcome.xpGain} XP · streak {outcome.streak} {outcome.streak === 1 ? "day" : "days"}</li>
          {outcome.beatStreak ? <li>You beat your best streak.</li> : null}
          {outcome.playerLevelAfter > outcome.playerLevelBefore ? (
            <li>You reached player level {outcome.playerLevelAfter}.</li>
          ) : null}
          {nextName ? <li>Level {outcome.openedLevelId} is open. {nextName} is on your path.</li> : null}
          {!nextName && metrics.walkingScore < 80 ? <li>An 80 on the planned stage opens the next one.</li> : null}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button render={<Link href="/therapist" />} className="h-11 rounded-full bg-forest px-4 text-white">
            Read Maya&apos;s note
          </Button>
          <Button render={<Link href="/progress" />} variant="outline" className="h-11 rounded-full px-4">
            Review progress
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-full px-4" onClick={onAgain}>
            Walk it again
          </Button>
        </div>
      </section>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f6faf6] px-2 py-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function CenterNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0e2419] px-6 text-white">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-white/75">{body}</p>
        <Link href="/play" className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-ink">
          Back to the path
        </Link>
      </div>
    </div>
  )
}
