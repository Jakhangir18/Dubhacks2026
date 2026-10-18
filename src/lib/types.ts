export type Foot = "L" | "R"

export type Quality = "perfect" | "good" | "miss" | "off"

export type LevelImage = "garden" | "river"

export type Level = {
  id: number
  name: string
  minutes: number
  image: LevelImage
  setting: string
  chip: string
  summary: string
  detail: string
  focus: readonly [string, string, string]
}

export type SessionSource = "clinic" | "form-round"

export type SessionRecord = {
  id: string
  levelId: number
  levelName: string
  playedAt: string
  durationMin: number
  walkingScore: number
  pace: number
  symmetry: number
  posture: number
  steps: number
  feedback: string
  source: SessionSource
}

export type ChatMessage = {
  id: string
  from: "maya" | "jordan"
  text: string
  at: string
}

export type CareRequest = {
  id: string
  topic: string
  message: string
  contact: string
  at: string
}

export type Sensors = {
  camera: boolean
  trackpad: boolean
}

export type AppState = {
  xp: number
  bestStreak: number
  streakBeatOn: string | null
  weeklyGoalMin: number
  unlockedThrough: number
  prescribedLevelId: number
  sessions: SessionRecord[]
  messages: ChatMessage[]
  careRequests: CareRequest[]
  sensors: Sensors
  readNotificationIds: string[]
}

export type StepEvent = {
  foot: Foot
  quality: Quality
  at: number
  early: boolean
}

export type LiveState = {
  startedAt: number
  lastStepAt: number
  expected: Foot
  posture: number
  pressure: number
  wave: number
  stepsThisWave: number
  samples: number[]
  events: StepEvent[]
  lastCue: string
  finished: boolean
  elapsed: number
}

export type RoundMetrics = {
  pace: number
  symmetry: number
  posture: number
  walkingScore: number
  steps: number
}

export type CompletionInput = {
  levelId: number
  levelName: string
  durationMin: number
  walkingScore: number
  pace: number
  symmetry: number
  posture: number
  steps: number
  source: SessionSource
}

export type Outcome = {
  session: SessionRecord
  xpGain: number
  openedLevelId: number | null
  streak: number
  beatStreak: boolean
  playerLevelBefore: number
  playerLevelAfter: number
}
