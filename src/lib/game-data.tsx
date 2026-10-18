"use client"

/** What every page shares: which player this is, whether the game server answers, their sessions as walks (or the
 * demo walks while the server has none), the active session and the integration status. */

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { api, usePoll, type ActiveSession, type Session, type Status } from "@/lib/game"
import { demoWalks, walkFromSession, type Walk } from "@/lib/walks"

/** The game's own page keeps the current player under this key; the dashboard shares the origin, so it reads it. */
export const PLAYER_KEY = "zombiewalk.player"

type GameData = {
  /** null until the first answer; false when the server does not answer. */
  online: boolean | null
  status: Status | null
  players: string[]
  player: string
  setPlayer: (name: string) => void
  sessions: Session[]
  /** Newest first: the player's real walks, or the demo walks while there are none. */
  walks: Walk[]
  latest: Walk | null
  demo: boolean
  loading: boolean
  active: ActiveSession | null
  running: boolean
  refresh: () => void
}

const GameContext = createContext<GameData | null>(null)

function storedPlayer(): string | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY)
    if (!raw) return null
    return raw.startsWith('"') ? (JSON.parse(raw) as string) : raw
  } catch {
    return null
  }
}

function subscribeStorage(listener: () => void) {
  window.addEventListener("storage", listener)
  return () => window.removeEventListener("storage", listener)
}

const noStoredPlayer = () => null

function reviewPending(rows: Session[] | null) {
  return (rows ?? []).some((row) => row.gaitReview?.status === "waiting" || row.gaitReview?.status === "reviewing")
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const stored = useSyncExternalStore(subscribeStorage, storedPlayer, noStoredPlayer)
  const status = usePoll(api.status, 30000)
  const players = usePoll(api.players, 30000)
  const active = usePoll(api.active, 3000)

  // The therapist's choice wins, then the stored one (when the server knows it), then whoever is walking, then
  // the first player on the server.
  const list = players.data
  const player =
    chosen ??
    (stored && (!list || list.includes(stored)) ? stored : null) ??
    active.data?.player ??
    list?.[0] ??
    "Player"

  const loadSessions = useCallback(() => api.sessions(player), [player])
  // A review on its way (waiting for the side camera, or Maya reading the numbers) is looked at more often.
  const sessionsDelay = useCallback((rows: Session[] | null) => (reviewPending(rows) ? 4000 : 10000), [])
  const sessions = usePoll(loadSessions, sessionsDelay, true, player)

  const setPlayer = useCallback((name: string) => {
    const clean = name.trim().slice(0, 40) || "Player"
    setChosen(clean)
    try {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(clean))
    } catch {
      /* storage blocked: the choice lasts the session */
    }
  }, [])

  const refreshSessions = sessions.refresh
  const refreshPlayers = players.refresh
  const refreshActive = active.refresh
  const refresh = useCallback(() => {
    refreshSessions()
    refreshPlayers()
    refreshActive()
  }, [refreshSessions, refreshPlayers, refreshActive])

  const value = useMemo<GameData>(() => {
    const online = status.polled ? status.data !== null || sessions.data !== null : null
    const real = (sessions.data ?? []).map(walkFromSession).sort((a, b) => b.at - a.at)
    const demo = sessions.polled && real.length === 0
    const walks = demo ? demoWalks() : real
    const current = active.data?.id ? active.data : null
    return {
      online,
      status: status.data,
      players: list ?? [],
      player,
      setPlayer,
      sessions: sessions.data ?? [],
      walks,
      latest: walks[0] ?? null,
      demo,
      loading: !sessions.polled,
      active: current,
      running: Boolean(current),
      refresh,
    }
  }, [status.polled, status.data, sessions.data, sessions.polled, list, player, setPlayer, active.data, refresh])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const value = useContext(GameContext)
  if (!value) throw new Error("useGame must be used inside GameProvider")
  return value
}
