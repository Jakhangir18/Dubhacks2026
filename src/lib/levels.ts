import type { Level, LevelImage } from "@/lib/types"

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "First Steps",
    minutes: 10,
    image: "garden",
    setting: "A straight garden path",
    chip: "Find the beat",
    summary: "Find a comfortable cadence on a short, even path.",
    detail:
      "The projection stays straight and slow. The camera learns your shoulder line, and the trackpad learns the gap between your steps. Nothing is scored until the rhythm settles.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 2,
    name: "Garden Path",
    minutes: 12,
    image: "garden",
    setting: "A gentle bend in the path",
    chip: "Soft turns",
    summary: "Walk the projected path without rushing the bends.",
    detail:
      "The path bends just enough to tempt a longer step. Keep the left and right identical, and let the turn happen under you instead of reaching for it.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 3,
    name: "Steady Pace",
    minutes: 14,
    image: "garden",
    setting: "A longer meadow line",
    chip: "Hold the rhythm",
    summary: "Hold one rhythm while the path gets longer.",
    detail:
      "Distance is the new variable. The score drops if you speed up to finish. Your own step interval is the whole task.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 4,
    name: "Meadow Loop",
    minutes: 14,
    image: "garden",
    setting: "A closed loop",
    chip: "Come back even",
    summary: "A closed loop. Keep the stride even when you return.",
    detail:
      "Loops expose a drifting step. By the time you pass the start, left and right should still match. The camera watches for a lean into the turn.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 5,
    name: "Hill Climb",
    minutes: 16,
    image: "garden",
    setting: "A rising path",
    chip: "Stay stacked",
    summary: "The projection rises. Stay upright as the effort changes.",
    detail:
      "You will want to tip forward. Shorten both steps the same amount and keep the ribs stacked. The hill is a posture test wearing a garden.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 6,
    name: "River Crossing",
    minutes: 12,
    image: "river",
    setting: "Stones in shallow water",
    chip: "Stones ahead",
    summary: "Short steps across the stones. Balance beats speed.",
    detail:
      "The trackpad reads a narrower stance here. Quick, uneven steps are how this score falls apart. Place, then place again.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 7,
    name: "Orchard Rows",
    minutes: 18,
    image: "garden",
    setting: "Repeated rows",
    chip: "Fatigue, still even",
    summary: "Repeat the row. Tired legs still owe you an even stride.",
    detail:
      "This is the first session long enough to get sloppy in the last third. The camera flags a drop in height. The score you want is the one you can still produce when you are bored of the row.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 8,
    name: "Plants vs. Zombies",
    minutes: 18,
    image: "garden",
    setting: "The garden, with a wave closing in",
    chip: "Wave 3 approaching",
    summary:
      "Defeat the wave with steady steps, balanced posture, and precise movement.",
    detail:
      "The path is projected at your feet. The wave advances when pace, symmetry, or posture slips, and it recedes when all three hold. You are not asked to be fast. You are asked to be exact.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 9,
    name: "Night Garden",
    minutes: 18,
    image: "garden",
    setting: "The same path, less light",
    chip: "Trust the cadence",
    summary: "A dimmer path. Trust the cadence you already own.",
    detail:
      "With less to look at, people stare at their feet and fold. Keep the eyes up. The trackpad already knows the rhythm. Your job is the upright trunk.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
  {
    id: 10,
    name: "Bloom Line",
    minutes: 20,
    image: "river",
    setting: "The long crossing",
    chip: "Distance, still even",
    summary: "The longest path. Add distance without giving symmetry back.",
    detail:
      "This is the session the earlier levels were building. Twenty minutes, one cadence, an even left and right, and a trunk that stays stacked when you are ready to be done.",
    focus: ["Steady pace", "Even stride", "Upright posture"],
  },
]

export const LEVEL_IMAGES: Record<LevelImage, string> = {
  garden: "/images/hero-garden.jpg",
  river: "/images/hero-river.jpg",
}

export const LEVEL_IMAGE_ALT: Record<LevelImage, string> = {
  garden:
    "A person walking a sunlit garden path projected across a physical therapy studio floor",
  river:
    "A person walking a shallow river projected onto a physical therapy studio floor",
}

export function levelById(id: number) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0]
}

export const XP_LEVELS = [0, 350, 800, 1300, 1850, 2400, 2800, 3400, 4100, 4900]

export function playerLevel(xp: number) {
  let level = 1
  for (let index = 0; index < XP_LEVELS.length; index += 1) {
    if (xp >= XP_LEVELS[index]) level = index + 1
  }
  return level
}

export function levelBounds(xp: number) {
  const level = playerLevel(xp)
  const floor = XP_LEVELS[level - 1] ?? 0
  const ceil = XP_LEVELS[level] ?? floor + 800
  return { level, floor, ceil }
}

export const PATIENT = {
  name: "Jordan Davis",
  firstName: "Jordan",
  initials: "JD",
  memberSince: "March 2026",
  goal: "Even stride and a quiet, upright trunk after knee recovery.",
  clinician: "StrideBloom care team",
}
