import { addDaysUTC, dayKey, startOfWeekUTC, uid } from "@/lib/format"
import { LEVELS, levelBounds, levelById, playerLevel } from "@/lib/levels"
import { feedbackFor } from "@/lib/maya"
import type {
  AppState,
  CompletionInput,
  Outcome,
  SessionRecord,
} from "@/lib/types"

export type WeekDay = {
  key: string
  label: string
  minutes: number
  isToday: boolean
  hasSession: boolean
}

export type LevelStatus = "done" | "current" | "locked"

export type Notification = {
  id: string
  title: string
  body: string
  href: string
  kind: "link" | "kit"
}

export type Derived = {
  now: Date
  todayKey: string
  streak: number
  practicedToday: boolean
  playerLevel: number
  levelFloor: number
  levelCeil: number
  walkingScore: number
  scoreDelta: number
  week: WeekDay[]
  lastWeek: WeekDay[]
  weekMinutes: number
  lastWeekMinutes: number
  recent: SessionRecord[]
  latest: SessionRecord | null
  prescribed: ReturnType<typeof levelById>
  levels: Array<ReturnType<typeof levelById> & { status: LevelStatus; best: number | null }>
  notifications: Notification[]
  unreadCount: number
}

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

export function computeStreak(sessions: SessionRecord[], now: Date) {
  const keys = new Set(sessions.map((session) => session.playedAt.slice(0, 10)))
  let cursor = keys.has(dayKey(now)) ? now : addDaysUTC(now, -1)
  let streak = 0
  while (keys.has(dayKey(cursor)) && streak < 365) {
    streak += 1
    cursor = addDaysUTC(cursor, -1)
  }
  return streak
}

function weekFrom(sessions: SessionRecord[], start: Date, todayKey: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysUTC(start, index)
    const key = dayKey(date)
    const minutes = sessions
      .filter((session) => session.playedAt.slice(0, 10) === key)
      .reduce((sum, session) => sum + session.durationMin, 0)
    return {
      key,
      label: WEEK_LABELS[index],
      minutes,
      isToday: key === todayKey,
      hasSession: minutes > 0,
    }
  })
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function derive(state: AppState, now = new Date()): Derived {
  const todayKey = dayKey(now)
  const sorted = state.sessions.slice().sort((a, b) => b.playedAt.localeCompare(a.playedAt))
  const recentFive = sorted.slice(0, 5).map((session) => session.walkingScore)
  const priorFive = sorted.slice(5, 10).map((session) => session.walkingScore)
  const recentAvg = average(recentFive)
  const priorAvg = average(priorFive)
  const walkingScore = Math.round(recentAvg)
  const scoreDelta = priorAvg ? Math.round(((recentAvg - priorAvg) / priorAvg) * 100) : 0
  const weekStart = startOfWeekUTC(now)
  const week = weekFrom(state.sessions, weekStart, todayKey)
  const lastWeek = weekFrom(state.sessions, addDaysUTC(weekStart, -7), todayKey)
  const prescribed = levelById(state.prescribedLevelId)
  const bestByLevel = new Map<number, number>()
  for (const session of state.sessions) {
    const current = bestByLevel.get(session.levelId)
    if (current === undefined || session.walkingScore > current) {
      bestByLevel.set(session.levelId, session.walkingScore)
    }
  }
  const levels = LEVELS.map((level) => {
    const best = bestByLevel.get(level.id) ?? null
    const status: LevelStatus =
      level.id > state.unlockedThrough
        ? "locked"
        : level.id === state.prescribedLevelId
          ? "current"
          : "done"
    return { ...level, status, best }
  })
  const kitReady = state.sensors.camera && state.sensors.trackpad
  const missing = [
    !state.sensors.camera ? "Camera" : null,
    !state.sensors.trackpad ? "Trackpad" : null,
  ].filter(Boolean)
  const notifications: Notification[] = [
    {
      id: "maya-note",
      title: "Maya left a note",
      body: "Symmetry is up this week. She wants the same rhythm, with a little more distance.",
      href: "/therapist",
      kind: "link",
    },
    {
      id: `level-${state.prescribedLevelId}`,
      title: `Level ${String(state.prescribedLevelId).padStart(2, "0")} is ready`,
      body: `${prescribed.name} is the recovery goal on your plan. The plant walk stays the same.`,
      href: `/play/session?level=${state.prescribedLevelId}`,
      kind: "link",
    },
    {
      id: kitReady ? "kit-ok" : "kit-attention",
      title: kitReady ? "Movement kit connected" : "A sensor needs a check",
      body: kitReady
        ? "Camera and trackpad both answered."
        : `${missing.join(" and ")} did not answer. Reconnect before a scored walk.`,
      href: "/play",
      kind: "kit",
    },
  ]
  const { level, floor, ceil } = levelBounds(state.xp)
  return {
    now,
    todayKey,
    streak: computeStreak(state.sessions, now),
    practicedToday: state.sessions.some((session) => session.playedAt.slice(0, 10) === todayKey),
    playerLevel: level,
    levelFloor: floor,
    levelCeil: ceil,
    walkingScore,
    scoreDelta,
    week,
    lastWeek,
    weekMinutes: week.reduce((sum, day) => sum + day.minutes, 0),
    lastWeekMinutes: lastWeek.reduce((sum, day) => sum + day.minutes, 0),
    recent: sorted,
    latest: sorted[0] ?? null,
    prescribed,
    levels,
    notifications,
    unreadCount: notifications.filter((note) => !state.readNotificationIds.includes(note.id)).length,
  }
}

export function planCompletion(state: AppState, input: CompletionInput, now = new Date()) {
  const metrics = {
    pace: input.pace,
    symmetry: input.symmetry,
    walkingScore: input.walkingScore,
    steps: input.steps,
  }
  const feedback = feedbackFor(metrics, input.levelName)
  const session: SessionRecord = {
    id: uid("walk"),
    levelId: input.levelId,
    levelName: input.levelName,
    playedAt: now.toISOString(),
    durationMin: input.durationMin,
    walkingScore: input.walkingScore,
    pace: input.pace,
    symmetry: input.symmetry,
    steps: input.steps,
    feedback,
    source: input.source,
  }
  const sessions = [session, ...state.sessions]
  let prescribedLevelId = state.prescribedLevelId
  let unlockedThrough = state.unlockedThrough
  let openedLevelId: number | null = null
  if (input.levelId === state.prescribedLevelId && input.walkingScore >= 80) {
    const next = LEVELS.find((level) => level.id === state.prescribedLevelId + 1)
    if (next) {
      prescribedLevelId = next.id
      unlockedThrough = Math.max(unlockedThrough, next.id)
      openedLevelId = next.id
    }
  }
  const xpGain = Math.round(input.walkingScore * 6)
  const xp = state.xp + xpGain
  const streak = computeStreak(sessions, now)
  const beatStreak = streak > state.bestStreak
  const outcome: Outcome = {
    session,
    xpGain,
    openedLevelId,
    streak,
    beatStreak,
    playerLevelBefore: playerLevel(state.xp),
    playerLevelAfter: playerLevel(xp),
  }
  const nextState: AppState = {
    ...state,
    sessions,
    xp,
    prescribedLevelId,
    unlockedThrough,
    bestStreak: Math.max(state.bestStreak, streak),
    streakBeatOn: beatStreak ? dayKey(now) : state.streakBeatOn,
    messages: [
      ...state.messages,
      {
        id: uid("maya"),
        from: "maya",
        text: feedback,
        at: now.toISOString(),
      },
    ],
  }
  return { state: nextState, outcome }
}

export function streakCopy(state: AppState, derived: Derived) {
  if (state.streakBeatOn === derived.todayKey) return "You beat your best streak."
  if (!derived.practicedToday && derived.streak > 0 && derived.streak === state.bestStreak) {
    return "One more session to beat your best streak."
  }
  if (!derived.practicedToday && derived.streak > 0) {
    return "Practice today and the streak holds."
  }
  if (derived.streak === 0) return "A scored walk today starts a new streak."
  return "Streak held. The next one counts tomorrow."
}
