/** The game server's client: the JSON the FastAPI server (server/app.py, server/api.py) answers with, typed, and
 * the WebSocket it broadcasts camera events on. Everything is same-origin: `/api/...` and `/ws/game`. */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { wsUrl } from "@/lib/paths"

export type Side = "L" | "R"
export type Sides<T = number | null> = { L: T; R: T }

// ---------------------------------------------------------------- sessions (POST /api/session, web/logic.js summary())
export type TimelinePoint = { t: number; cadence: number | null; evenPct: number | null; act: string }
export type Segment = { act: string; round: number; startS: number; endS: number | null }
export type Lanes = { L: [number, number]; R: [number, number] }

export type GameSummary = {
  seconds?: number
  act?: string
  steps?: number | null
  cadence?: number | null
  asymmetryPct?: number | null
  stompPct?: number | null
  dodgePct?: number | null
  formPct?: number | null
  goldenPct?: number | null
  petals?: number | null
  bouquets?: number | null
  rounds?: number | null
  score?: number | null
  shoeMode?: boolean
  seedAct?: boolean
  thisRound?: { round: number; hit: number; n: number }
  highLiftAvgCm?: Sides
  stepsByFoot?: Sides<number>
  byLane?: { flower?: Lanes; seed?: Lanes }
  placementCm?: Sides | null
  timingS?: Sides | null
  swingCm?: Sides | null
  timeline?: TimelinePoint[]
  segments?: Segment[]
  wallSeconds?: number
}

/** gait.py GaitTracker.summary(), the parts the dashboard reads. Knee angles are the inside angle: 180 = straight. */
export type GaitSummary = {
  direction?: string | null
  cadence?: number | null
  cadence_steps?: number | null
  fps?: number | null
  stride?: Sides
  stride_cv?: Sides
  flexion?: Sides
  knee?: Sides<{ peak_bend?: number | null; rom?: number | null } | null>
  toe_lift_cm?: Sides
  heel_first_pct?: Sides
  step_length_cm?: Sides
  stance_pct?: Sides
  seen_frames?: Sides<number | null>
  asymmetry?: Record<string, number | null>
  strike_counts?: Sides<number | null>
}

export type Gait = {
  source?: string
  quality?: Record<string, unknown> | null
  summary?: GaitSummary | null
  perAct?: Record<string, GaitSummary | null>
  ts?: number
}

export type ReviewMetric = {
  id: string
  label: string
  group: string
  side: Side | null
  value: number
  unit: string
  typical: string | null
  trust: "good" | "low"
  prev: number | null
}
export type Cited = { text: string; evidence: string[] }
export type Finding = Cited & { area: string; side: Side | "both" | "none"; confidence: "high" | "medium" | "low" }
export type Review = {
  overview: string
  strengths: Cited[]
  findings: Finding[]
  gameVsGait: Cited[]
  actComparison: string
  trend: string
  focus: { text: string; why: string; evidence: string[] }
  nextSession: { liftCm: number | null; spacingCm: number | null; minCadence: number | null; why: string }
  cues: string[]
  playerFeedback: string
  parentNote: string
  therapistNote: string
  nextRecording: string
}
export type ReviewStatus = "waiting" | "reviewing" | "done" | "failed"
export type GaitReview = {
  status: ReviewStatus
  source?: "gemini" | "rules"
  model?: string | null
  reason?: string | null
  dataQuality?: { level: "good" | "ok" | "poor"; issues: string[] }
  metrics?: ReviewMetric[]
  withheld?: { id: string; reason: string }[]
  review?: Review
  filledByRules?: string[]
  ts?: number
}

/** One row of GET /api/sessions/{player} (the gait summary is trimmed there) or GET /api/session/{id}. */
export type Session = {
  id?: string
  player: string
  ts: number
  verified: boolean
  note?: string
  rewarded?: boolean
  summary: GameSummary
  gait?: Gait | null
  gaitReview?: GaitReview | null
}

// ---------------------------------------------------------------- players and the therapist's settings
export type PlayerLimits = {
  minCadence: number
  walkSeconds: number
  gardenPlants: number
  stormSeeds: number
  liftCm: number
  liftRange: [number, number]
  spacingCm: number
  spacingRange: [number, number]
  sessionMinutes: number
  speedScale: number
  rounds: number
}
export type Reward = { name: string; usd: number }
export type Player = {
  name: string
  limits: PlayerLimits
  rewards: Reward[]
  notes: string
  perceptronConsent: boolean
  aiReviewConsent: boolean
  assistantId?: string | null
  gait?: { ts?: number; source?: string; summary?: GaitSummary | null; used?: boolean } | null
}
export type PlayerPatch = {
  limits?: Partial<PlayerLimits>
  rewards?: Reward[]
  notes?: string
  perceptronConsent?: boolean
  aiReviewConsent?: boolean
}

export type Status = { gemini: boolean; backboard: boolean; storage: string; visa: string; perceptron: boolean; voice?: boolean }
export type Health = Record<string, { ok: boolean; detail: string }>
export type ActiveSession = { id?: string | null; player?: string | null; startedAt?: number; serverTime: number }

/** A run-log row (POST /api/log from the game): `what` is 'cue', 'pace', 'flower', 'seed' or 'act'. */
export type LogRow = {
  ts: number
  what?: string
  say?: string
  cadence?: number
  steps?: number
  form?: number
  lane?: string
  result?: string
  act?: string
  round?: number
  t?: number
  player?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------- the side camera: moments and the live skeleton
export type MomentKind = "knee_low" | "uneven" | "good"
export type Moment = {
  sessionId: string
  id: string
  momentKind: MomentKind
  side: Side | null
  valueDeg: number | null
  targetDeg: number | null
  t: number
  title: string
  explain: string
  img: string
}

export type SideframeStatus = { connected: boolean; fps: number; ageS: number | null; seq: number }

export const POSE_KEYS = [
  "l_shoulder", "r_shoulder", "l_hip", "r_hip", "l_knee", "r_knee",
  "l_ankle", "r_ankle", "l_heel", "r_heel", "l_toe", "r_toe",
] as const
export type PoseKey = (typeof POSE_KEYS)[number]
/** [x, y, visibility], x and y as fractions of the side picture (origin top-left). */
export type PosePoint = [number, number, number]
export type Pose = { kind: "pose"; source: string; t: number; pts: Partial<Record<PoseKey, PosePoint>>; knee: Sides }

// ---------------------------------------------------------------- the game screen: its state, and the commands to it
export type GameScene = "title" | "intro" | "ready" | "play" | "home" | "zone"
export type GameAct = "walk" | "garden" | "rest" | null
/** What the game page sends once a second and on every change; the server keeps the newest. */
export type GameState = {
  kind: "gamestate"
  scene: GameScene
  act: GameAct
  round: number | null
  rounds: number | null
  paused: boolean
  score: number
  stompPct: number | null
  t: number
  sessionId: string | null
  voice: boolean
  speed: number | null
}
export type GameStatus = { state: GameState | null; ageS: number | null; connected: boolean }
export const CONTROL_CMDS = ["start", "pause", "resume", "next", "end", "restart", "voice", "faster", "slower", "autowalk"] as const
export type ControlCmd = (typeof CONTROL_CMDS)[number]
export type ControlAnswer = { ok: boolean; id: string; gameConnected: boolean }
export type ControlEvent = { kind: "control"; cmd: ControlCmd; id: string; t: number }

export type GameEvent = { kind: string } & Record<string, unknown>
export type FrameEvent = { kind: "frame"; source: string; jpeg: string }

export function isFrame(ev: GameEvent): ev is FrameEvent {
  return ev.kind === "frame" && typeof ev.jpeg === "string"
}
export function isPose(ev: GameEvent): ev is Pose {
  return ev.kind === "pose" && typeof ev.pts === "object" && ev.pts !== null
}
export function isMoment(ev: GameEvent): ev is Moment & { kind: "moment" } {
  return ev.kind === "moment" && typeof ev.id === "string" && typeof ev.img === "string"
}
export function isGameState(ev: GameEvent): ev is GameState {
  return ev.kind === "gamestate" && typeof ev.scene === "string"
}
export function isControl(ev: GameEvent): ev is ControlEvent {
  return ev.kind === "control" && typeof ev.cmd === "string"
}

// ---------------------------------------------------------------- fetchers
export class ApiError extends Error {
  status: number
  constructor(status: number, path: string) {
    super(`${status} ${path}`)
    this.status = status
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" }, cache: "no-store" })
  if (!response.ok) throw new ApiError(response.status, path)
  return (await response.json()) as T
}

async function sendJson<T>(path: string, method: "PUT" | "POST", body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status, path)
  return (await response.json()) as T
}

/** null when the server has no such route yet (404); the caller falls back. */
async function optional<T>(path: string): Promise<T | null> {
  try {
    return await getJson<T>(path)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

const enc = encodeURIComponent

export const api = {
  status: () => getJson<Status>("/api/status"),
  health: () => getJson<Health>("/api/health"),
  players: () => getJson<string[]>("/api/players"),
  player: (name: string) => getJson<Player>(`/api/player/${enc(name)}`),
  savePlayer: (name: string, patch: PlayerPatch) => sendJson<Player>(`/api/player/${enc(name)}`, "PUT", patch),
  sessions: (name: string) => getJson<Session[]>(`/api/sessions/${enc(name)}`),
  session: (id: string) => getJson<Session>(`/api/session/${enc(id)}`),
  /** Oldest first; an empty list while the server has none (or no such route yet). */
  moments: async (id: string) => (await optional<{ moments: Moment[] }>(`/api/session/${enc(id)}/moments`))?.moments ?? [],
  active: () => getJson<ActiveSession>("/api/session/active"),
  log: (n = 120) => getJson<LogRow[]>(`/api/log?n=${n}`),
  cues: async (n = 60) => (await api.log(n)).filter((row) => row.what === "cue"),
  sideframeStatus: () => optional<SideframeStatus>("/api/sideframe/status"),
  /** null while the server has no game routes yet. */
  gameState: () => optional<GameStatus>("/api/game/state"),
  control: (cmd: ControlCmd) => sendJson<ControlAnswer>("/api/game/control", "POST", { cmd }),
  qrUrl: (url: string) => `/api/qr?url=${enc(url)}`,
}

// ---------------------------------------------------------------- hooks
export type Polled<T> = {
  data: T | null
  error: Error | null
  /** The first answer (or failure) has arrived. */
  polled: boolean
  refresh: () => void
}

/** Calls `load` now and then every `ms` (a number, or a function of the last answer) while the tab is visible;
 * keeps the last data through a failed call. A changed `load` or `ms` is picked up at the next call; a changed
 * `key` (the player, a session id) starts over at once. */
export function usePoll<T>(load: () => Promise<T>, ms: number | ((data: T | null) => number), enabled = true, key: string | number = ""): Polled<T> {
  const loadRef = useRef(load)
  const msRef = useRef(ms)
  useEffect(() => {
    loadRef.current = load
    msRef.current = ms
  })
  const [state, setState] = useState<{ data: T | null; error: Error | null; polled: boolean }>({ data: null, error: null, polled: false })
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let latest: T | null = null
    let timer: number | undefined
    const delay = () => {
      const value = msRef.current
      return typeof value === "function" ? value(latest) : value
    }
    const run = async () => {
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(run, 2000)
        return
      }
      try {
        const data = await loadRef.current()
        latest = data
        if (alive) setState({ data, error: null, polled: true })
      } catch (error) {
        if (alive) setState((current) => ({ data: current.data, error: error instanceof Error ? error : new Error(String(error)), polled: true }))
      }
      if (alive) timer = window.setTimeout(run, delay())
    }
    void run()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [enabled, round, key])

  const refresh = useCallback(() => setRound((value) => value + 1), [])
  return { ...state, refresh }
}

/** The game's event stream (/ws/game): JSON arrays of events; reconnects two seconds after a drop. */
export function useGameSocket(onEvents: (events: GameEvent[]) => void, enabled = true) {
  const handler = useRef(onEvents)
  useEffect(() => {
    handler.current = onEvents
  })
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let socket: WebSocket | null = null
    let timer: number | undefined
    let closed = false
    const connect = () => {
      try {
        socket = new WebSocket(wsUrl("/ws/game"))
      } catch {
        timer = window.setTimeout(connect, 2000)
        return
      }
      socket.onopen = () => setConnected(true)
      socket.onmessage = (message) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(String(message.data))
        } catch {
          return
        }
        const list = (Array.isArray(parsed) ? parsed : [parsed]).filter(
          (item): item is GameEvent => typeof item === "object" && item !== null && typeof (item as GameEvent).kind === "string",
        )
        if (list.length) handler.current(list)
      }
      socket.onclose = () => {
        setConnected(false)
        if (!closed) timer = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket?.close()
    }
    connect()
    return () => {
      closed = true
      window.clearTimeout(timer)
      socket?.close()
    }
  }, [enabled])

  return connected
}

const noopSubscribe = () => () => {}

/** False while the page is rendered ahead of time and during hydration, true after: for anything that reads the
 * clock or the browser, so the static HTML and the first client render agree. */
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

/** A clock that ticks every `ms`, for "seen 3 s ago" labels. */
export function useTicker(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}
