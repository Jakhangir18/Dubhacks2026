"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { dayKey, uid } from "@/lib/format"
import { levelById } from "@/lib/levels"
import { feedbackFor } from "@/lib/maya"
import { derive, planCompletion, type Derived } from "@/lib/metrics"
import type {
  AppState,
  CareRequest,
  ChatMessage,
  CompletionInput,
  Outcome,
  SessionRecord,
  SessionSource,
} from "@/lib/types"

const STORAGE_KEY = "stridebloom-state-v3"

type StoreValue = {
  state: AppState
  derived: Derived
  completeSession: (input: CompletionInput) => Outcome
  setSensor: (key: "camera" | "trackpad", online: boolean) => void
  reconnectKit: () => void
  markNotificationsRead: () => void
  addMessage: (message: ChatMessage) => void
  submitCare: (input: { topic: string; message: string; contact: string }) => void
  resetDemo: () => void
  kitOpen: boolean
  setKitOpen: (open: boolean) => void
  profileOpen: boolean
  setProfileOpen: (open: boolean) => void
  contactOpen: boolean
  setContactOpen: (open: boolean) => void
  notesOpen: boolean
  setNotesOpen: (open: boolean) => void
}

const StoreContext = createContext<StoreValue | null>(null)

function isoDaysAgo(now: Date, days: number, hour: number) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, hour, 12, 0),
  ).toISOString()
}

function seedSession(
  now: Date,
  input: {
    id: string
    levelId: number
    daysAgo: number
    durationMin: number
    walkingScore: number
    pace: number
    symmetry: number
    steps: number
    source?: SessionSource
  },
): SessionRecord {
  const level = levelById(input.levelId)
  const metrics = {
    pace: input.pace,
    symmetry: input.symmetry,
    walkingScore: input.walkingScore,
    steps: input.steps,
  }
  return {
    id: input.id,
    levelId: level.id,
    levelName: level.name,
    playedAt: isoDaysAgo(now, input.daysAgo, 16),
    durationMin: input.durationMin,
    ...metrics,
    feedback: feedbackFor(metrics, level.name),
    source: input.source ?? "clinic",
  }
}

export function createSeed(now = new Date()): AppState {
  const sessions = [
    seedSession(now, { id: "s1", levelId: 8, daysAgo: 1, durationMin: 16, walkingScore: 88, pace: 90, symmetry: 86, steps: 1680 }),
    seedSession(now, { id: "s2", levelId: 6, daysAgo: 2, durationMin: 12, walkingScore: 81, pace: 84, symmetry: 78, steps: 1120 }),
    seedSession(now, { id: "s3", levelId: 7, daysAgo: 3, durationMin: 18, walkingScore: 82, pace: 80, symmetry: 84, steps: 1764 }),
    seedSession(now, { id: "s4", levelId: 5, daysAgo: 4, durationMin: 14, walkingScore: 78, pace: 76, symmetry: 80, steps: 1344 }),
    seedSession(now, { id: "s5", levelId: 4, daysAgo: 5, durationMin: 14, walkingScore: 85, pace: 86, symmetry: 83, steps: 1302 }),
    seedSession(now, { id: "s6", levelId: 3, daysAgo: 8, durationMin: 15, walkingScore: 79, pace: 78, symmetry: 80, steps: 1400 }),
    seedSession(now, { id: "s7", levelId: 3, daysAgo: 9, durationMin: 12, walkingScore: 76, pace: 75, symmetry: 77, steps: 1188 }),
    seedSession(now, { id: "s8", levelId: 2, daysAgo: 10, durationMin: 12, walkingScore: 81, pace: 82, symmetry: 79, steps: 1210 }),
    seedSession(now, { id: "s9", levelId: 2, daysAgo: 11, durationMin: 11, walkingScore: 79, pace: 77, symmetry: 80, steps: 1090 }),
    seedSession(now, { id: "s10", levelId: 1, daysAgo: 15, durationMin: 10, walkingScore: 77, pace: 80, symmetry: 74, steps: 980 }),
    seedSession(now, { id: "s11", levelId: 1, daysAgo: 16, durationMin: 10, walkingScore: 91, pace: 90, symmetry: 92, steps: 1020 }),
    seedSession(now, { id: "s12", levelId: 6, daysAgo: 18, durationMin: 12, walkingScore: 72, pace: 70, symmetry: 74, steps: 1104 }),
  ]
  return {
    xp: 2840,
    bestStreak: 5,
    streakBeatOn: null,
    weeklyGoalMin: 90,
    unlockedThrough: 8,
    prescribedLevelId: 8,
    sessions,
    messages: [
      {
        id: "m1",
        from: "jordan",
        text: "My steps got short and quick. Was I rushing?",
        at: isoDaysAgo(now, 2, 16),
      },
      {
        id: "m2",
        from: "maya",
        text: "On Narrow stance you scored 80, with symmetry at 78. The misses clustered when the steps got short and quick. Hold the cadence from Steady pace, and let the plants arrive under you.",
        at: isoDaysAgo(now, 2, 16),
      },
      {
        id: "m3",
        from: "maya",
        text: "Your stride symmetry improved this week. Today, keep that rhythm while adding a little more distance.",
        at: isoDaysAgo(now, 0, 8),
      },
    ],
    careRequests: [],
    sensors: { camera: true, trackpad: true },
    readNotificationIds: [],
  }
}

function isState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<AppState>
  return Array.isArray(candidate.sessions) && typeof candidate.xp === "number" && Array.isArray(candidate.messages)
}

function hydrate(raw: string): AppState {
  const seed = createSeed(new Date())
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isState(parsed)) return seed
    return {
      ...seed,
      ...parsed,
      sensors: { ...seed.sensors, ...parsed.sensors },
      careRequests: parsed.careRequests ?? [],
      readNotificationIds: parsed.readNotificationIds ?? [],
      streakBeatOn: parsed.streakBeatOn ?? null,
      sessions: parsed.sessions,
      messages: parsed.messages,
    }
  } catch {
    return seed
  }
}

const listeners = new Set<() => void>()
let memory: AppState | null = null
let memoryRaw: string | null = null
let serverMemory: { key: string; state: AppState } | null = null

function emit() {
  listeners.forEach((listener) => listener())
}

function writeState(next: AppState) {
  const raw = JSON.stringify(next)
  memory = next
  memoryRaw = raw
  localStorage.setItem(STORAGE_KEY, raw)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    memory = null
    memoryRaw = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? ""
  if (memory && memoryRaw === raw) return memory
  memoryRaw = raw
  memory = raw ? hydrate(raw) : createSeed(new Date())
  return memory
}

function getServerSnapshot() {
  const key = dayKey(new Date())
  if (!serverMemory || serverMemory.key !== key) {
    serverMemory = { key, state: createSeed(new Date()) }
  }
  return serverMemory.state
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [kitOpen, setKitOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const derived = useMemo(() => derive(state), [state])

  const completeSession = useCallback((input: CompletionInput) => {
    const planned = planCompletion(getSnapshot(), input, new Date())
    writeState(planned.state)
    return planned.outcome
  }, [])

  const setSensor = useCallback((key: "camera" | "trackpad", online: boolean) => {
    const current = getSnapshot()
    writeState({ ...current, sensors: { ...current.sensors, [key]: online } })
  }, [])

  const reconnectKit = useCallback(() => {
    writeState({ ...getSnapshot(), sensors: { camera: true, trackpad: true } })
  }, [])

  const markNotificationsRead = useCallback(() => {
    const current = getSnapshot()
    const ids = derive(current).notifications.map((note) => note.id)
    writeState({
      ...current,
      readNotificationIds: Array.from(new Set([...current.readNotificationIds, ...ids])),
    })
  }, [])

  const addMessage = useCallback((message: ChatMessage) => {
    const current = getSnapshot()
    writeState({ ...current, messages: [...current.messages, message] })
  }, [])

  const submitCare = useCallback((input: { topic: string; message: string; contact: string }) => {
    const request: CareRequest = { id: uid("care"), ...input, at: new Date().toISOString() }
    const current = getSnapshot()
    writeState({ ...current, careRequests: [request, ...current.careRequests] })
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    writeState(createSeed(new Date()))
  }, [])

  const openNotes = useCallback((open: boolean) => {
    setNotesOpen(open)
    if (!open) return
    const current = getSnapshot()
    const ids = derive(current).notifications.map((note) => note.id)
    writeState({
      ...current,
      readNotificationIds: Array.from(new Set([...current.readNotificationIds, ...ids])),
    })
  }, [])

  const api = useMemo<StoreValue>(
    () => ({
      state,
      derived,
      completeSession,
      setSensor,
      reconnectKit,
      markNotificationsRead,
      addMessage,
      submitCare,
      resetDemo,
      kitOpen,
      setKitOpen,
      profileOpen,
      setProfileOpen,
      contactOpen,
      setContactOpen,
      notesOpen,
      setNotesOpen: openNotes,
    }),
    [
      addMessage,
      completeSession,
      contactOpen,
      derived,
      kitOpen,
      markNotificationsRead,
      notesOpen,
      openNotes,
      profileOpen,
      reconnectKit,
      resetDemo,
      setSensor,
      state,
      submitCare,
    ],
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStride() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStride must be used inside StoreProvider")
  return value
}
