import type { RoundMetrics } from "@/lib/types"
import { durationLabel, mayaLine, reviewOf, whenLabel, workOn, type Walk } from "@/lib/walks"

/** The demo seed's note for one StrideBloom session (kept for the offline demo data). */
export function feedbackFor(metrics: RoundMetrics, levelName: string) {
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
  latest: Walk | null
  walks: Walk[]
  streak: number
  weekMinutes: number
  goalMinutes: number
  now: Date
}

function pct(value: number | null, unit = "%") {
  return value === null ? "not measured" : `${value}${unit}`
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

/** Maya's scripted answers, built from the real walks (or the demo walks) so the chat never contradicts the page. */
export function mayaReply(text: string, ctx: MayaContext) {
  const question = text.toLowerCase()
  const latest = ctx.latest
  const when = latest ? whenLabel(latest.at, ctx.now).toLowerCase() : ""

  if (/hurt|pain|sore|swell|sharp|injur|fell|dizzy|numb/.test(question)) {
    return "Please stop walking practice if something hurts, swells, or feels sharp. I review form. I don't assess pain. Send a note to the care team and wait for a clinician before you load that side again."
  }
  if (!latest) {
    return "Finish a walk and I will have something specific to say. Until then, the two cues are a steady pace and even steps, left and right."
  }
  const review = reviewOf(latest)
  const focus = workOn(latest)

  if (/knee|lift|bend|clear|toe|foot up|high step/.test(question)) {
    const { L, R } = latest.kneeDeg
    if (L === null && R === null) {
      return `The side camera did not measure your knees on the walk ${when}. Put the phone on its stand at the side of the pad, knee height, and the next walk will show the knee bend for each leg.`
    }
    const low = ([L, R] as const).some((value) => value !== null && value < 45)
    return `On the walk ${when} the left knee bent ${pct(L, "°")} and the right ${pct(R, "°")} in swing. ${low ? "A little more bend lifts the foot clear of the belt; think knee up, then step down onto the flower." : "That is a good bend for clearing the belt. Keep it on both sides."}`
  }
  if (/symmetr|even|limp|one side|left|right|balance/.test(question)) {
    const lanes = latest.lanes
    const laneText = lanes && (lanes.L[1] || lanes.R[1])
      ? ` Flowers: ${lanes.L[0]} of ${lanes.L[1]} in the left lane, ${lanes.R[0]} of ${lanes.R[1]} in the right.`
      : ""
    const steps = latest.stepsByFoot.L !== null && latest.stepsByFoot.R !== null ? ` Steps: ${latest.stepsByFoot.L} left, ${latest.stepsByFoot.R} right.` : ""
    return `Left and right were ${pct(latest.evenPct)} even on the walk ${when}.${laneText}${steps} Even means both steps take the same time. If one side reaches, shorten that step; do not push the other one longer to compensate.`
  }
  if (/pace|cadence|rhythm|fast|slow|rush|beat|speed/.test(question)) {
    const line = latest.timeline.filter((point) => point.cadence)
    const half = Math.floor(line.length / 2)
    const first = average(line.slice(0, half).map((point) => point.cadence as number))
    const second = average(line.slice(half).map((point) => point.cadence as number))
    const trend = first && second ? ` It went from about ${first} in the first half to ${second} in the second.` : ""
    return `Your pace ${when} was ${pct(latest.cadence, " steps a minute")}.${trend} Pick the rhythm you can hold while talking and keep it through the last round.`
  }
  if (/flower|stomp|aim|target|golden|petal|seed|miss/.test(question)) {
    const golden = latest.goldenPct !== null ? ` Golden flowers: ${latest.goldenPct}%.` : ""
    const petals = latest.petals !== null ? ` You collected ${latest.petals} petals.` : ""
    return `You stepped on ${pct(latest.flowersPct)} of the flowers ${when}.${golden}${petals} Eyes on the glow and step right onto it as it reaches your foot.`
  }
  if (/streak/.test(question)) {
    return ctx.streak > 0
      ? `You are on a ${ctx.streak}-night streak. A night counts when you finish a walk. One honest round is enough.`
      : "There is no active streak. One walk tonight starts it."
  }
  if (/camera|phone|video|moment|picture|skeleton/.test(question)) {
    return "The phone at the side of the pad is the side camera. It draws your legs as sticks, measures the knee bend of each step, and keeps a picture of the moments worth looking at, with a plain explanation. Open Live walk to see it."
  }
  if (/score|progress|week|how am i|how'm i|doing|better|worse/.test(question)) {
    const recent = average(ctx.walks.slice(0, 5).map((walk) => walk.flowersPct).filter((value): value is number => value !== null))
    const prior = average(ctx.walks.slice(5, 10).map((walk) => walk.flowersPct).filter((value): value is number => value !== null))
    const compare = recent !== null && prior !== null ? ` Over the last five walks you stepped on ${recent}% of the flowers, against ${prior}% in the five before.` : ""
    return `You have ${ctx.walks.length} ${ctx.walks.length === 1 ? "walk" : "walks"} on record.${compare} This week you have ${ctx.weekMinutes} of ${ctx.goalMinutes} minutes.`
  }
  if (/today|focus|should i|next|plan|work on/.test(question)) {
    return `${focus.text}${focus.why ? ` ${focus.why}` : ""} The two cues stay the same: a steady pace and even steps.`
  }
  if (/why|what does|mean|explain/.test(question) && review) {
    return `${review.overview} ${focus.text}`
  }
  const line = mayaLine(latest)
  return `On the walk ${when} you took ${latest.steps ?? "some"} steps in ${durationLabel(latest.seconds)}, stepped on ${pct(latest.flowersPct)} of the flowers and were ${pct(latest.evenPct)} even. ${line ?? ""} Ask me about the knees, the pace, the flowers, or what to work on next.`.replace(/\s+/g, " ")
}
