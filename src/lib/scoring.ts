import type { Foot, LiveState, Quality, RoundMetrics, StepEvent } from "@/lib/types"

export const STEP_MS = 720
export const WAVE_STEPS = 12
export const WAVE_COUNT = 2
export const MIN_SCORED_STEPS = 6

const PERFECT_MS = 150
const GOOD_MS = 300
const POSTURE_DECAY = 0.85

export function createLive(now: number): LiveState {
  return {
    startedAt: now,
    lastStepAt: 0,
    expected: "L",
    posture: 92,
    pressure: 6,
    wave: 1,
    stepsThisWave: 0,
    samples: [92],
    events: [],
    lastCue: "Start with the left foot.",
    finished: false,
    elapsed: 0,
  }
}

function cueFor(quality: Quality, early: boolean) {
  if (quality === "perfect") return "Steady pace."
  if (quality === "good") return "Close. Stay with that interval."
  if (quality === "off") return "Even stride. Switch feet."
  return early ? "A little early. Let the beat come to you." : "A little late. Keep the next one on time."
}

function pushSample(samples: number[], posture: number) {
  const next = samples.length >= 500 ? samples.slice(-499) : samples.slice()
  next.push(posture)
  return next
}

export function tick(state: LiveState, now: number): LiveState {
  if (state.finished) return state
  const warming = now - state.startedAt < 1200
  const posture = warming ? state.posture : Math.max(0, state.posture - POSTURE_DECAY)
  let pressure = state.pressure
  if (!warming) {
    if (posture < 45) pressure = Math.min(100, pressure + 0.45)
    else if (posture >= 70) pressure = Math.max(0, pressure - 0.12)
  }
  let lastCue = state.lastCue
  if (pressure >= 100) {
    pressure = 56
    lastCue = "The wave surged. Reset your pace and stand tall."
  }
  return {
    ...state,
    posture,
    pressure,
    lastCue,
    elapsed: Math.max(0, now - state.startedAt),
    samples: pushSample(state.samples, posture),
  }
}

export function standTall(state: LiveState): LiveState {
  if (state.finished) return state
  const posture = Math.min(100, state.posture + 34)
  return {
    ...state,
    posture,
    lastCue: posture >= 85 ? "Upright posture." : "Stack the ribs over the pelvis.",
    samples: pushSample(state.samples, posture),
  }
}

export function takeStep(state: LiveState, foot: Foot, now: number): LiveState {
  if (state.finished) return state
  if (state.events.length === 0 && foot !== "L") {
    return { ...state, lastCue: "Start with the left foot." }
  }

  let quality: Quality = "perfect"
  let early = false
  if (state.events.length > 0 && foot !== state.expected) {
    quality = "off"
  } else if (state.events.length > 0) {
    const signed = now - state.lastStepAt - STEP_MS
    const gap = Math.abs(signed)
    early = signed < 0
    quality = gap <= PERFECT_MS ? "perfect" : gap <= GOOD_MS ? "good" : "miss"
  }

  let pressure = state.pressure
  if (quality === "perfect") pressure = Math.max(0, pressure - 7)
  if (quality === "good") pressure = Math.max(0, pressure - 3)
  if (quality === "miss") pressure = Math.min(100, pressure + 8)
  if (quality === "off") pressure = Math.min(100, pressure + 11)

  const event: StepEvent = { foot, quality, at: now, early }
  let stepsThisWave = state.stepsThisWave + 1
  let wave = state.wave
  let finished = false
  let lastCue = cueFor(quality, early)

  if (stepsThisWave >= WAVE_STEPS) {
    if (wave >= WAVE_COUNT) {
      finished = true
      lastCue = "Round complete."
    } else {
      wave += 1
      stepsThisWave = 0
      pressure = Math.max(0, pressure - 14)
      lastCue = "Wave 2. Same cadence."
    }
  }

  return {
    ...state,
    lastStepAt: quality === "off" ? state.lastStepAt : now,
    expected: quality === "off" ? state.expected : foot === "L" ? "R" : "L",
    pressure,
    events: [...state.events, event],
    stepsThisWave,
    wave,
    finished,
    lastCue,
    elapsed: Math.max(0, now - state.startedAt),
  }
}

export function summarize(state: LiveState): RoundMetrics {
  const events = state.events
  const steps = events.length
  const pacePoints: Record<Quality, number> = {
    perfect: 100,
    good: 84,
    miss: 52,
    off: 36,
  }
  const pace = Math.round(
    events.reduce((sum, event) => sum + pacePoints[event.quality], 0) / Math.max(steps, 1),
  )
  const left = events.filter((event) => event.foot === "L").length
  const right = events.filter((event) => event.foot === "R").length
  const offs = events.filter((event) => event.quality === "off").length
  const balance = 100 - Math.min(100, (Math.abs(left - right) / Math.max(steps, 1)) * 100)
  const alternate = 100 - (offs / Math.max(steps, 1)) * 100
  const symmetry = Math.round(balance * 0.4 + alternate * 0.6)
  const posture = Math.round(
    state.samples.reduce((sum, sample) => sum + sample, 0) / Math.max(state.samples.length, 1),
  )
  const walkingScore = clamp(Math.round(pace * 0.35 + symmetry * 0.3 + posture * 0.35), 1, 99)
  return { pace, symmetry, posture, walkingScore, steps }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function chipLights(state: LiveState) {
  const last = state.events[state.events.length - 1]
  return {
    pace: Boolean(last && (last.quality === "perfect" || last.quality === "good")),
    stride: Boolean(last && last.quality !== "off"),
    posture: state.posture >= 70,
  }
}
