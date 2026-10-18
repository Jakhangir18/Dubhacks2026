import type { Level, LevelImage } from "@/lib/types"

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Comfortable cadence",
    minutes: 10,
    image: "garden",
    setting: "Early recovery · a step rate you can keep",
    chip: "Find the beat",
    summary: "The same plant walk. The goal is a cadence that feels easy.",
    detail:
      "You stomp the plants on a short lawn. Nothing is scored until the rhythm settles. The trackpad learns the gap between your steps.",
    focus: ["Comfortable pace", "Matching steps", "Quiet landings"],
  },
  {
    id: 2,
    name: "Even stride",
    minutes: 12,
    image: "garden",
    setting: "Symmetry · left and right share the work",
    chip: "Match both sides",
    summary: "Same lawn. The goal is a left step and a right step that match.",
    detail:
      "The plants still come at the same walk. The score is whether both feet take the same time and the same length. If one side reaches, shorten that step.",
    focus: ["Same step time", "Same step length", "No long side"],
  },
  {
    id: 3,
    name: "Soft landings",
    minutes: 14,
    image: "garden",
    setting: "Foot contact · heel, then a quiet roll",
    chip: "Heel, then toe",
    summary: "Same plants. The goal is a soft heel-to-toe landing, not a slap.",
    detail:
      "Watch the foot meet the floor. Let the heel land, then roll through the toes. Both sides should sound the same.",
    focus: ["Heel first", "Roll through", "Same both sides"],
  },
  {
    id: 4,
    name: "Steady pace",
    minutes: 14,
    image: "garden",
    setting: "Control · one rhythm for the whole walk",
    chip: "Don't speed up",
    summary: "Same walk, a little longer. The goal is not to rush the finish.",
    detail:
      "The plants keep coming. The score drops if you speed up to get through them. Your own step interval is the whole task.",
    focus: ["One cadence", "No sprint finish", "Even stride"],
  },
  {
    id: 5,
    name: "Balanced effort",
    minutes: 16,
    image: "garden",
    setting: "Load · shorter steps when the work increases",
    chip: "Shorten both sides",
    summary: "The plants ask for more effort. The goal is not to lengthen one step to get through it.",
    detail:
      "When the walk feels harder, shorten both steps the same amount. Keep the cadence. This goal is even effort, still on the same lawn.",
    focus: ["Shorter even steps", "Same cadence", "Quiet landings"],
  },
  {
    id: 6,
    name: "Narrow stance",
    minutes: 12,
    image: "garden",
    setting: "Balance · a closer base, still even",
    chip: "Place, then place",
    summary: "Same plants, a narrower base. The goal is balance without quick steps.",
    detail:
      "The trackpad reads a closer stance. Quick, uneven steps are how this score falls apart. Place one foot, then the other, and let the plants arrive.",
    focus: ["Closer stance", "Unhurried steps", "Same step length"],
  },
  {
    id: 7,
    name: "Fatigue control",
    minutes: 18,
    image: "garden",
    setting: "Endurance · the last third stays even",
    chip: "Still even when tired",
    summary: "A longer plant walk. The goal is the stride you still have when you are tired.",
    detail:
      "This is the first goal long enough to get sloppy near the end. The score you want is the pace and the even stride you can still produce in the last third.",
    focus: ["Late-walk pace", "Late-walk symmetry", "No sprint finish"],
  },
  {
    id: 8,
    name: "Hold both cues",
    minutes: 18,
    image: "garden",
    setting: "Integration · pace and an even stride together",
    chip: "Both cues",
    summary: "Same plant walk. The goal is pace and symmetry at the same time.",
    detail:
      "The plants advance when pace or symmetry slips, and they recede when both hold. You are not asked to be fast. You are asked to be exact.",
    focus: ["Steady pace", "Even stride", "No rush"],
  },
  {
    id: 9,
    name: "Head-up walking",
    minutes: 18,
    image: "garden",
    setting: "Confidence · trust the cadence without watching your feet",
    chip: "Eyes up",
    summary: "The lawn does not change. The goal is to stop looking down for the next plant.",
    detail:
      "People stare at their feet and shorten one side. Keep the eyes up and let the trackpad keep the rhythm. Left and right should still match.",
    focus: ["Eyes on the horizon", "Trusted cadence", "Even stride"],
  },
  {
    id: 10,
    name: "Full distance",
    minutes: 20,
    image: "garden",
    setting: "Return to activity · the long walk, symmetry kept",
    chip: "Distance, still even",
    summary: "The longest plant walk. The goal is distance without giving symmetry back.",
    detail:
      "This is the goal the earlier ones were building. Twenty minutes, one cadence, and an even left and right when you are ready to be done.",
    focus: ["Long-walk pace", "Symmetry held", "Quiet finish"],
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

export const LEVEL_MARKS: Record<number, string> = {
  1: "/art/seed.png",
  2: "/art/flower-marigold.png",
  3: "/art/foot-r.png",
  4: "/art/flower-bell.png",
  5: "/art/house.png",
  6: "/art/seed.png",
  7: "/art/pod.png",
  8: "/art/gus-portrait.png",
  9: "/art/moon.png",
  10: "/art/flower-rose.png",
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
  goal: "Even stride and a steady cadence, one night at a time.",
  clinician: "Zombie Walk Home care team",
}
