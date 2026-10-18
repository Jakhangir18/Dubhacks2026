"use client"

/** The live walk, fused from the game server: the active session, the run log (coach cues, pace, flowers), the
 * side camera's fresh gait numbers, the event stream (camera pictures, the skeleton, moments) and the phone's
 * picture rate. Everything degrades to "waiting" when a source is silent. */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  api,
  isFrame,
  isGameState,
  isMoment,
  isPose,
  useGameSocket,
  usePoll,
  useTicker,
  type ActiveSession,
  type ControlCmd,
  type GameEvent,
  type GameState,
  type GameStatus,
  type LogRow,
  type Moment,
  type Pose,
  type PoseKey,
  type Sides,
  type SideframeStatus,
} from "@/lib/game"
import { kneeFromGait } from "@/lib/walks"

export const FRAME_FRESH_MS = 4000
export const TOP_LIVE_MS = 3000
export const POSE_FRESH_MS = 3000
export const GAIT_FRESH_S = 45
export const GAME_LIVE_MS = 3000
const RATE_WINDOW_MS = 5000
const MAX_MOMENTS = 40

/** The phone's picture rate every two seconds; a server without that route yet is asked again every 20 s. */
const sideframeDelay = (status: SideframeStatus | null) => (status === null ? 20000 : 2000)
const gameDelay = (status: GameStatus | null) => (status === null ? 20000 : 2000)

export type CameraState = { src: string | null; seenAt: number; fresh: boolean; seenEver: boolean }

// ---------------------------------------------------------------- the game screen: its state and the commands to it
export type LastCommand = { cmd: ControlCmd; ok: boolean; gameConnected: boolean; at: number; error: string | null }

export type GameScreen = {
  state: GameState | null
  /** A state arrived within the last three seconds (on the socket, or by the server's count). */
  connected: boolean
  ageS: number | null
  polled: boolean
  /** The server has no game routes yet. */
  missing: boolean
  control: (cmd: ControlCmd) => Promise<void>
  last: LastCommand | null
  busy: ControlCmd | null
  /** A gamestate seen on a socket the caller owns. */
  note: (state: GameState) => void
}

function controlError(error: unknown) {
  if (error instanceof ApiError && error.status === 429) return "Too many commands: wait a second."
  if (error instanceof ApiError && error.status === 404) return "This server has no game control yet."
  if (error instanceof ApiError) return `The server answered ${error.status}.`
  return "The server did not answer."
}

/** GET /api/game/state every two seconds plus the gamestate events on the socket; POST /api/game/control. */
export function useGameScreen(ownSocket = true): GameScreen {
  const now = useTicker(1000)
  const status = usePoll<GameStatus | null>(api.gameState, gameDelay)
  const [seen, setSeen] = useState<{ state: GameState | null; at: number }>({ state: null, at: 0 })
  const note = useCallback((state: GameState) => setSeen({ state, at: Date.now() }), [])
  const onEvents = useCallback(
    (events: GameEvent[]) => {
      const newest = events.filter(isGameState).pop()
      if (newest) note(newest)
    },
    [note],
  )
  useGameSocket(onEvents, ownSocket)
  const [last, setLast] = useState<LastCommand | null>(null)
  const [busy, setBusy] = useState<ControlCmd | null>(null)
  const refresh = status.refresh
  const control = useCallback(
    async (cmd: ControlCmd) => {
      setBusy(cmd)
      try {
        const answer = await api.control(cmd)
        setLast({ cmd, ok: answer.ok, gameConnected: answer.gameConnected, at: Date.now(), error: null })
      } catch (error) {
        setLast({ cmd, ok: false, gameConnected: false, at: Date.now(), error: controlError(error) })
      } finally {
        setBusy(null)
        refresh()
      }
    },
    [refresh],
  )
  const liveSeen = seen.state !== null && now - seen.at < GAME_LIVE_MS
  const state = liveSeen ? seen.state : (status.data?.state ?? seen.state)
  const connected = liveSeen || Boolean(status.data?.connected)
  const ageS = liveSeen ? Math.max(0, Math.round((now - seen.at) / 1000)) : (status.data?.ageS ?? null)
  return { state, connected, ageS, polled: status.polled, missing: status.polled && status.data === null, control, last, busy, note }
}

export type LiveWalk = {
  active: ActiveSession | null
  running: boolean
  sinceS: number
  game: GameScreen
  /** A top-camera picture (feet.py) arrived in the last three seconds. */
  topLive: boolean
  cameras: { top: CameraState; side: CameraState }
  pose: Pose | null
  poseFresh: boolean
  /** Pictures a second from the phone: the server's count, or the preview rate when the route is missing. */
  sideRate: number | null
  sideRateIsPreview: boolean
  sideLive: boolean
  moments: Moment[]
  cue: { say: string; ts: number } | null
  pace: { cadence: number; steps: number; form: number; ts: number } | null
  flowersRound: { hit: number; n: number; round: number | null } | null
  gait: { kneeDeg: Sides; evenPct: number | null; cadence: number | null; ageS: number } | null
  socket: boolean
  now: number
}

const SILENT: CameraState = { src: null, seenAt: 0, fresh: false, seenEver: false }

function flowersThisRound(rows: LogRow[]) {
  const starts = rows.filter((row) => row.what === "act" && row.act === "garden")
  const last = starts[starts.length - 1]
  const flowers = rows.filter((row) => row.what === "flower" && (!last || (row.t ?? 0) >= (last.t ?? 0)))
  if (!flowers.length && !last) return null
  return { hit: flowers.filter((row) => row.result === "hit").length, n: flowers.length, round: last?.round ?? null }
}

export function useLiveWalk(playerName: string): LiveWalk {
  const now = useTicker(1000)
  const active = usePoll(api.active, 2000)
  const log = usePoll(() => api.log(150), 2000)
  const sideframe = usePoll<SideframeStatus | null>(api.sideframeStatus, sideframeDelay)
  const current = active.data?.id ? active.data : null
  const name = current?.player || playerName
  const loadPlayer = useCallback(() => api.player(name), [name])
  const player = usePoll(loadPlayer, 3000, Boolean(name), name)

  const game = useGameScreen(false)
  const noteGame = game.note
  const [cameras, setCameras] = useState<{ top: CameraState; side: CameraState }>({ top: SILENT, side: SILENT })
  const [poseState, setPoseState] = useState<{ pose: Pose | null; at: number }>({ pose: null, at: 0 })
  const [moments, setMoments] = useState<Moment[]>([])
  const sideTimes = useRef<number[]>([])
  const [previewRate, setPreviewRate] = useState(0)

  // The preview rate: side pictures in the last few seconds, re-counted on the clock so it falls when they stop.
  useEffect(() => {
    const at = Date.now()
    sideTimes.current = sideTimes.current.filter((t) => at - t < RATE_WINDOW_MS)
    setPreviewRate(sideTimes.current.length / (RATE_WINDOW_MS / 1000))
  }, [now])

  const onEvents = useCallback((events: GameEvent[]) => {
    const at = Date.now()
    let top: string | null = null
    let side: string | null = null
    let pose: Pose | null = null
    let state: GameState | null = null
    const fresh: Moment[] = []
    for (const event of events) {
      if (isFrame(event)) {
        if (event.source === "side") side = event.jpeg
        else top = event.jpeg
      } else if (isPose(event)) {
        pose = event
      } else if (isMoment(event)) {
        fresh.push(event)
      } else if (isGameState(event)) {
        state = event
      }
    }
    if (state) noteGame(state)
    if (top || side) {
      if (side) sideTimes.current = [...sideTimes.current.filter((t) => at - t < RATE_WINDOW_MS), at]
      setCameras((state) => ({
        top: top ? { src: top, seenAt: at, fresh: true, seenEver: true } : state.top,
        side: side ? { src: side, seenAt: at, fresh: true, seenEver: true } : state.side,
      }))
    }
    if (pose) setPoseState({ pose, at })
    if (fresh.length) {
      setMoments((list) => {
        const known = new Set(list.map((item) => item.id))
        const added = fresh.filter((item) => !known.has(item.id))
        return added.length ? [...added.reverse(), ...list].slice(0, MAX_MOMENTS) : list
      })
    }
  }, [noteGame])
  const socket = useGameSocket(onEvents)

  // The moments the server already kept for this session (newest first on the page).
  const sessionId = current?.id ?? null
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    api
      .moments(sessionId)
      .then((list) => {
        if (!alive || !list.length) return
        setMoments((state) => {
          const known = new Set(state.map((item) => item.id))
          const older = list.filter((item) => !known.has(item.id)).reverse()
          return [...state, ...older].slice(0, MAX_MOMENTS)
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [sessionId])

  // Freshness is judged on the one-second clock: a picture or pose counts as live for a few seconds after it came.
  const freshen = (camera: CameraState): CameraState => ({ ...camera, fresh: camera.seenEver && now - camera.seenAt < FRAME_FRESH_MS })
  const poseFresh = poseState.pose !== null && now - poseState.at < POSE_FRESH_MS
  const side = freshen(cameras.side)

  const status: SideframeStatus | null = sideframe.data
  const statusMissing = sideframe.polled && sideframe.data === null
  const sideLive = status ? status.connected : side.fresh
  const sideRate = status ? status.fps : statusMissing || side.seenEver ? previewRate : null

  const since = current?.startedAt ?? 0
  const rows = (log.data ?? []).filter((row) => !current || (row.ts ?? 0) >= since)
  const lastCue = [...(log.data ?? [])].reverse().find((row) => row.what === "cue" && typeof row.say === "string")
  const lastPace = [...rows].reverse().find((row) => row.what === "pace")

  const gaitDoc = player.data?.gait
  const gaitAge = gaitDoc?.ts ? now / 1000 - gaitDoc.ts : null
  const gaitSummary = gaitDoc?.summary ?? null
  const asym = gaitSummary?.asymmetry?.step_time ?? gaitSummary?.asymmetry?.stride ?? null
  const gait =
    gaitSummary && gaitAge !== null && gaitAge < GAIT_FRESH_S
      ? {
          kneeDeg: kneeFromGait(gaitSummary),
          evenPct: typeof asym === "number" ? Math.max(0, Math.round(100 - asym)) : null,
          cadence: typeof gaitSummary.cadence === "number" ? Math.round(gaitSummary.cadence) : null,
          ageS: Math.round(gaitAge),
        }
      : null

  return {
    active: current,
    running: Boolean(current),
    sinceS: current ? Math.max(0, Math.round((active.data?.serverTime ?? now / 1000) - (current.startedAt ?? 0))) : 0,
    game,
    topLive: cameras.top.seenEver && now - cameras.top.seenAt < TOP_LIVE_MS,
    cameras: { top: freshen(cameras.top), side },
    pose: poseFresh ? poseState.pose : null,
    poseFresh,
    sideRate,
    sideRateIsPreview: !status,
    sideLive,
    moments,
    cue: lastCue ? { say: lastCue.say as string, ts: lastCue.ts } : null,
    pace: lastPace && typeof lastPace.cadence === "number"
      ? { cadence: lastPace.cadence, steps: Number(lastPace.steps ?? 0), form: Number(lastPace.form ?? 0), ts: lastPace.ts }
      : null,
    flowersRound: current ? flowersThisRound(rows) : null,
    gait,
    socket,
    now,
  }
}

// ---------------------------------------------------------------- is the whole body in the picture?
export type BodyPart = { name: string; keys: readonly [PoseKey, PoseKey]; seen: boolean }

const PARTS: ReadonlyArray<{ name: string; keys: readonly [PoseKey, PoseKey] }> = [
  { name: "Shoulders", keys: ["l_shoulder", "r_shoulder"] },
  { name: "Hips", keys: ["l_hip", "r_hip"] },
  { name: "Knees", keys: ["l_knee", "r_knee"] },
  { name: "Ankles", keys: ["l_ankle", "r_ankle"] },
]
const VISIBLE = 0.5

export function bodyCheck(pose: Pose | null): { parts: BodyPart[]; ok: boolean; advice: string } {
  const parts = PARTS.map((part) => ({
    ...part,
    seen: Boolean(pose) && part.keys.some((key) => (pose?.pts[key]?.[2] ?? 0) >= VISIBLE),
  }))
  const seen = (name: string) => parts.find((part) => part.name === name)?.seen ?? false
  const ok = parts.every((part) => part.seen)
  let advice = "Whole body in view."
  if (!pose) advice = "Stand on the pad, side on to the phone, so the camera sees your whole body."
  else if (!seen("Ankles")) advice = "Move the phone back so your feet are in the picture."
  else if (!seen("Shoulders")) advice = "Move the phone back, or tilt it up a little, so your shoulders are in the picture."
  else if (!seen("Knees") || !seen("Hips")) advice = "Lower the phone to knee height, side on to the pad."
  return { parts, ok, advice }
}

/** The side camera only, for pages that show a banner but not the cameras. */
export function useSideCamera() {
  const now = useTicker(1000)
  const sideframe = usePoll<SideframeStatus | null>(api.sideframeStatus, sideframeDelay)
  const missing = sideframe.polled && sideframe.data === null
  const [seenAt, setSeenAt] = useState(0)
  const onEvents = useCallback((events: GameEvent[]) => {
    if (events.some((event) => isFrame(event) && event.source === "side")) setSeenAt(Date.now())
  }, [])
  useGameSocket(onEvents, missing)
  const live = sideframe.data ? sideframe.data.connected : seenAt > 0 && now - seenAt < 3000
  return { live, polled: sideframe.polled, rate: sideframe.data?.fps ?? null, now }
}
