import assert from "node:assert/strict"
import { createLive, STEP_MS, summarize, takeStep, tick, WAVE_COUNT, WAVE_STEPS } from "./scoring.ts"

function playEven() {
  let state = createLive(0)
  let nextStep = 0
  let foot: "L" | "R" = "L"
  for (let now = 0; now <= STEP_MS * (WAVE_STEPS * WAVE_COUNT + 2); now += 100) {
    if (!state.finished && now >= nextStep) {
      state = takeStep(state, foot, now)
      foot = foot === "L" ? "R" : "L"
      nextStep += STEP_MS
    }
    if (!state.finished) state = tick(state, now)
    if (state.finished) break
  }
  return state
}

function playUneven() {
  let state = createLive(0)
  let nextStep = 0
  for (let now = 0; now <= STEP_MS * (WAVE_STEPS * WAVE_COUNT + 2); now += 100) {
    if (!state.finished && now >= nextStep) {
      state = takeStep(state, "L", now)
      nextStep += STEP_MS
    }
    if (!state.finished) state = tick(state, now)
    if (state.finished) break
  }
  return state
}

const even = summarize(playEven())
const uneven = summarize(playUneven())

assert.equal(playEven().finished, true)
assert.equal(even.steps, WAVE_STEPS * WAVE_COUNT)
assert.ok(even.pace >= 95, `pace ${even.pace}`)
assert.ok(even.symmetry >= 95, `symmetry ${even.symmetry}`)
assert.ok(even.walkingScore >= 90, `score ${even.walkingScore}`)
assert.equal("posture" in even, false)
assert.ok(uneven.symmetry < even.symmetry, `uneven symmetry ${uneven.symmetry}`)
assert.ok(uneven.walkingScore < even.walkingScore, `uneven score ${uneven.walkingScore}`)

let ignored = createLive(0)
ignored = takeStep(ignored, "R", 0)
assert.equal(ignored.events.length, 0)

console.log("scoring ok", even, uneven)
