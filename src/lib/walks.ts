/** One walk as the pages show it: a game session from the server, or a demo walk from the seed when there is no
 * server data. The plain-words helpers (what went well, what to work on next) read the AI review first, then the
 * side camera's moments, then the numbers. */

import { createSeed } from "@/lib/store"
import type { GaitReview, GaitSummary, Moment, Review, Segment, Session, Side, Sides, TimelinePoint } from "@/lib/game"
import type { SessionRecord } from "@/lib/types"

export type Walk = {
  id: string
  /** False for old sessions without an id: the list shows them, the detail page cannot load them. */
  openable: boolean
  at: number
  seconds: number
  steps: number | null
  cadence: number | null
  flowersPct: number | null
  seedsPct: number | null
  evenPct: number | null
  formPct: number | null
  goldenPct: number | null
  petals: number | null
  bouquets: number | null
  rounds: number | null
  score: number | null
  home: boolean
  seedAct: boolean
  shoeMode: boolean
  highLiftCm: Sides
  stepsByFoot: Sides
  lanes: { L: [number, number]; R: [number, number] } | null
  kneeDeg: Sides
  strideS: Sides
  strideCv: Sides
  toeLiftCm: Sides
  heelFirstPct: Sides
  sideCadence: number | null
  nearSide: Side | null
  cameraFps: number | null
  timeline: TimelinePoint[]
  segments: Segment[]
  review: GaitReview | null
  note: string
  verified: boolean
  rewarded: boolean
  demo: boolean
}

const NONE: Sides = { L: null, R: null }
const NAME: Record<Side, string> = { L: "left", R: "right" }

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function sides(value: Partial<Sides<number | null | undefined>> | null | undefined): Sides {
  return { L: num(value?.L), R: num(value?.R) }
}

/** gait.py logs the inside knee angle (180 = straight); the bend is what a therapist reads. */
export function kneeFromGait(gait: GaitSummary | null | undefined): Sides {
  const bend = (side: Side) => {
    const inside = num(gait?.knee?.[side]?.peak_bend) ?? num(gait?.flexion?.[side])
    return inside === null ? null : Math.round(180 - inside)
  }
  return { L: bend("L"), R: bend("R") }
}

/** The leg nearer the side camera: seen confidently more often (like the server's near_side). */
export function nearSide(gait: GaitSummary | null | undefined): Side | null {
  if (!gait?.direction) return null
  const left = num(gait.seen_frames?.L)
  const right = num(gait.seen_frames?.R)
  if (left !== null && right !== null && Math.max(left, right) > 1.15 * Math.min(left, right)) return left > right ? "L" : "R"
  return gait.direction === "right" ? "R" : "L"
}

export function walkFromSession(session: Session): Walk {
  const s = session.summary ?? {}
  const gait = session.gait?.summary ?? null
  const asym = num(s.asymmetryPct)
  return {
    id: session.id ?? `ts-${Math.round(session.ts)}`,
    openable: Boolean(session.id),
    at: session.ts,
    seconds: num(s.seconds) ?? 0,
    steps: num(s.steps),
    cadence: num(s.cadence),
    flowersPct: num(s.stompPct),
    seedsPct: num(s.dodgePct),
    evenPct: asym === null ? null : Math.max(0, Math.round(100 - asym)),
    formPct: num(s.formPct),
    goldenPct: num(s.goldenPct),
    petals: num(s.petals),
    bouquets: num(s.bouquets),
    rounds: num(s.rounds),
    score: num(s.score),
    home: s.act === "home",
    seedAct: Boolean(s.seedAct),
    shoeMode: Boolean(s.shoeMode),
    highLiftCm: sides(s.highLiftAvgCm),
    stepsByFoot: sides(s.stepsByFoot),
    lanes: s.byLane?.flower ?? null,
    kneeDeg: kneeFromGait(gait),
    strideS: sides(gait?.stride),
    strideCv: sides(gait?.stride_cv),
    toeLiftCm: sides(gait?.toe_lift_cm),
    heelFirstPct: sides(gait?.heel_first_pct),
    sideCadence: num(gait?.cadence),
    nearSide: nearSide(gait),
    cameraFps: num(gait?.fps) ?? num(session.gait?.quality?.fps),
    timeline: Array.isArray(s.timeline) ? s.timeline : [],
    segments: Array.isArray(s.segments) ? s.segments : [],
    review: session.gaitReview ?? null,
    note: session.note ?? "",
    verified: Boolean(session.verified),
    rewarded: Boolean(session.rewarded),
    demo: false,
  }
}

/** The StrideBloom seed as walks: its scores stand in for flowers hit and evenness, cadence is steps over minutes. */
export function walkFromDemo(record: SessionRecord): Walk {
  return {
    id: record.id,
    openable: true,
    at: Date.parse(record.playedAt) / 1000,
    seconds: record.durationMin * 60,
    steps: record.steps,
    cadence: Math.round(record.steps / Math.max(1, record.durationMin)),
    flowersPct: record.walkingScore,
    seedsPct: null,
    evenPct: record.symmetry,
    formPct: record.pace,
    goldenPct: null,
    petals: null,
    bouquets: null,
    rounds: 2,
    score: null,
    home: true,
    seedAct: false,
    shoeMode: true,
    highLiftCm: NONE,
    stepsByFoot: NONE,
    lanes: null,
    kneeDeg: NONE,
    strideS: NONE,
    strideCv: NONE,
    toeLiftCm: NONE,
    heelFirstPct: NONE,
    sideCadence: null,
    nearSide: null,
    cameraFps: null,
    timeline: [],
    segments: [],
    review: null,
    note: record.feedback,
    verified: true,
    rewarded: false,
    demo: true,
  }
}

export function demoWalks(now = new Date()): Walk[] {
  return createSeed(now)
    .sessions.map(walkFromDemo)
    .sort((a, b) => b.at - a.at)
}

// ---------------------------------------------------------------- the review's state and words
export function reviewOf(walk: Walk): Review | null {
  return walk.review?.status === "done" ? (walk.review.review ?? null) : null
}

export type ReviewState = { kind: "done" | "waiting" | "reviewing" | "failed" | "none"; label: string; source?: string }

export function reviewState(walk: Walk): ReviewState {
  const review = walk.review
  if (!review) return { kind: "none", label: walk.demo ? "Demo walk" : "No side camera" }
  if (review.status === "done") {
    const source = review.source === "gemini" ? "Reviewed by Maya (Gemini)" : "Reviewed by Maya (rules)"
    return { kind: "done", label: source, source: review.model ?? undefined }
  }
  if (review.status === "waiting") return { kind: "waiting", label: "Waiting for the side camera" }
  if (review.status === "reviewing") return { kind: "reviewing", label: "Maya is reviewing" }
  return { kind: "failed", label: review.reason ? `Review failed: ${review.reason}` : "Review failed" }
}

function sentence(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** One warm sentence about the best thing in the walk. */
export function wentWell(walk: Walk): string {
  const review = reviewOf(walk)
  if (review?.strengths?.[0]?.text) return sentence(review.strengths[0].text)
  if (walk.flowersPct !== null && walk.flowersPct >= 75) return `You stepped on ${walk.flowersPct}% of the flowers: good aim with the feet.`
  if (walk.evenPct !== null && walk.evenPct >= 85) return `Left and right steps were evenly timed (${walk.evenPct}%).`
  if (walk.goldenPct !== null && walk.goldenPct >= 75) return `You caught ${walk.goldenPct}% of the golden flowers.`
  if (walk.home) return "You kept walking the whole way and Gus got home."
  if (walk.steps) return `You kept walking: ${walk.steps} steps in ${durationLabel(walk.seconds)}.`
  return "You showed up and walked. That is the hard part."
}

export type Focus = { text: string; why: string | null; from: "review" | "moment" | "numbers" }

/** The one thing to work on next: the review's focus, else the side camera's first moment, else the numbers. */
export function workOn(walk: Walk, moments: Moment[] = []): Focus {
  const review = reviewOf(walk)
  if (review?.focus?.text) return { text: sentence(review.focus.text), why: review.focus.why ? sentence(review.focus.why) : null, from: "review" }
  const moment = moments.find((item) => item.momentKind !== "good")
  if (moment) return { text: sentence(moment.title), why: sentence(moment.explain), from: "moment" }
  if (walk.flowersPct !== null && walk.flowersPct < 60) {
    return { text: "Step right onto each flower as it reaches your foot.", why: `${walk.flowersPct}% of the flowers were stepped on.`, from: "numbers" }
  }
  if (walk.evenPct !== null && walk.evenPct < 80) {
    return { text: "Make left and right steps the same size.", why: `Left and right were ${walk.evenPct}% even.`, from: "numbers" }
  }
  const lowKnee = (["L", "R"] as const).find((side) => walk.kneeDeg[side] !== null && (walk.kneeDeg[side] as number) < 45)
  if (lowKnee) {
    return { text: `Bend the ${NAME[lowKnee]} knee a little more each step.`, why: `The ${NAME[lowKnee]} knee bent ${walk.kneeDeg[lowKnee]} degrees in swing; more bend helps the foot clear the belt.`, from: "numbers" }
  }
  return { text: "Keep walking steady and even.", why: "Today's numbers look steady; the same rhythm again is the goal.", from: "numbers" }
}

/** Maya's words to the player: the review's, else the coach note, else nothing. */
export function mayaLine(walk: Walk | null): string | null {
  if (!walk) return null
  const review = reviewOf(walk)
  if (review?.playerFeedback) return review.playerFeedback
  return walk.note || null
}

// ---------------------------------------------------------------- time, in the viewer's own time zone
export function dayKeyLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function whenLabel(ts: number, now: Date) {
  const date = new Date(ts * 1000)
  const key = dayKeyLocal(date)
  if (key === dayKeyLocal(now)) return "Today"
  if (key === dayKeyLocal(addDays(now, -1))) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function clockLabel(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function durationLabel(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  if (minutes === 0) return `${rest} s`
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}

export function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

export type WeekDay = { key: string; label: string; minutes: number; isToday: boolean; hasSession: boolean }

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

export function startOfWeekLocal(now: Date) {
  const weekday = now.getDay()
  const start = addDays(now, -(weekday === 0 ? 6 : weekday - 1))
  start.setHours(0, 0, 0, 0)
  return start
}

export function weekOf(walks: Walk[], start: Date, now: Date): WeekDay[] {
  const today = dayKeyLocal(now)
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index)
    const key = dayKeyLocal(date)
    const seconds = walks.filter((walk) => dayKeyLocal(new Date(walk.at * 1000)) === key).reduce((sum, walk) => sum + walk.seconds, 0)
    const minutes = Math.round(seconds / 60)
    return { key, label: WEEK_LABELS[index], minutes, isToday: key === today, hasSession: seconds > 0 }
  })
}

/** Consecutive days with a walk, counting back from today (or yesterday when today has none yet). */
export function streakOf(walks: Walk[], now: Date) {
  const keys = new Set(walks.map((walk) => dayKeyLocal(new Date(walk.at * 1000))))
  let cursor = keys.has(dayKeyLocal(now)) ? now : addDays(now, -1)
  let streak = 0
  while (keys.has(dayKeyLocal(cursor)) && streak < 365) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}
