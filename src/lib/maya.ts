import type { RoundMetrics, SessionRecord } from "@/lib/types"

export function feedbackFor(
  metrics: RoundMetrics,
  levelName: string,
) {
  const weakest = metrics.pace <= metrics.symmetry ? "pace" : "symmetry"

  if (metrics.walkingScore >= 88) {
    return `That was a controlled round on ${levelName}. Pace and symmetry both sat in range. Next time, keep this rhythm and add a little more distance.`
  }
  if (weakest === "pace") {
    return `The steps were fairly even on ${levelName}. The score moved when the cadence rushed or dragged — pace landed at ${metrics.pace}. Let the plants come to you instead of chasing them.`
  }
  return `You favored one side on ${levelName}. Symmetry was ${metrics.symmetry}. Shorten the longer step just slightly so the left and right share the work. The trackpad is listening for that balance.`
}

export type MayaContext = {
  walkingScore: number
  delta: number
  latest: SessionRecord | null
  weekMinutes: number
  goal: number
  streak: number
  prescribedName: string
}

export function mayaReply(text: string, snapshot: MayaContext) {
  const question = text.toLowerCase()
  const latest = snapshot.latest

  if (/hurt|pain|sore|swell|sharp|injury|fell|dizzy|numb/.test(question)) {
    return "Please stop walking practice if something hurts, swells, or feels sharp. I review form. I don't assess pain. Send a note to the care team and wait for a clinician before you load that side again."
  }
  if (/symmetr|even|limp|one side|left|right/.test(question)) {
    if (!latest) return "I need one scored walk before I can talk about symmetry."
    return `Your latest symmetry is ${latest.symmetry} on ${latest.levelName}. Across the last five walks, the walking score sits at ${snapshot.walkingScore}. Even stride means the left and right step take the same time and the same length. If one side reaches, shorten that step. Don't push the other one longer to compensate.`
  }
  if (/pace|cadence|rhythm|fast|slow|rush|beat/.test(question)) {
    return latest
      ? `Pace was ${latest.pace} on ${latest.levelName}. The walks that score well do not speed up when the projection changes. Pick the interval you can hold while talking, and keep it through the last third.`
      : "Pick a cadence you could hold while talking, then don't negotiate with it."
  }
  if (/streak/.test(question)) {
    return snapshot.streak > 0
      ? `You are on a ${snapshot.streak}-day streak. A day counts when you finish a scored walk. One honest round is enough.`
      : "There is no active streak. One scored walk today starts it."
  }
  if (/level|stage|unlock|zombie|path|next/.test(question)) {
    return `${snapshot.prescribedName} is the goal on your plan. The walk is always the same plant lawn. Score 80 or better and the next goal opens. Replaying an earlier goal is useful. It will not skip the plan.`
  }
  if (/score|progress|week|how am i|how'm i|doing/.test(question)) {
    const direction = snapshot.delta > 0 ? "up" : snapshot.delta < 0 ? "down" : "flat"
    const amount = direction === "flat" ? "" : ` ${Math.abs(snapshot.delta)}%`
    return `Your walking score, averaged over the last five sessions, is ${snapshot.walkingScore}. That is ${direction}${amount} against the five before it. This week you have ${snapshot.weekMinutes} of ${snapshot.goal} minutes.`
  }
  if (/today|focus|should i|session|distance|plan/.test(question)) {
    return `Today is ${snapshot.prescribedName}. Keep the rhythm you already have, and add a little distance without stretching one side. The two cues stay the same: steady pace and an even stride.`
  }
  if (latest) {
    return `On ${latest.levelName} you scored ${latest.walkingScore}, with pace ${latest.pace} and symmetry ${latest.symmetry}. Ask me about either of those, or about what to hold onto today.`
  }
  return "Finish a scored walk and I will have something specific to say. Until then, the two cues are steady pace and an even stride."
}
