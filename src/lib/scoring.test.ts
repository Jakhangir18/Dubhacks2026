import assert from "node:assert/strict"
import { createLive, standTall, STEP_MS, summarize, takeStep, tick, WAVE_COUNT, WAVE_STEPS } from "./scoring.ts"

function playCareful() {
  let state = createLive(0)
  let nextStep = 0
  let foot: "L" | "R" = "L"
  for (let now = 0; now <= STEP_MS * (WAVE_STEPS * WAVE_COUNT + 2); now += 100) {
    if (!state.finished && now >= nextStep) {
      state = takeStep(state, foot, now)
      foot = foot === "L" ? "R" : "L"
      nextStep += STEP_MS
    }
    if (!state.finished && now > 0 && now % 1500 === 0) state = standTall(state)
    if (!state.finished) state = tick(state, now)
    if (state.finished) break
  }
  return state
}

function playNoPosture() {
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

const careful = summarize(playCareful())
const slumped = summarize(playNoPosture())

assert.equal(playCareful().finished, true)
assert.equal(careful.steps, WAVE_STEPS * WAVE_COUNT)
assert.ok(careful.pace >= 95, `pace ${careful.pace}`)
assert.ok(careful.symmetry >= 95, `symmetry ${careful.symmetry}`)
assert.ok(careful.posture >= 80, `posture ${careful.posture}`)
assert.ok(careful.walkingScore >= 90, `score ${careful.walkingScore}`)
assert.ok(slumped.posture < careful.posture, `slumped posture ${slumped.posture}`)
assert.ok(slumped.walkingScore < careful.walkingScore, `slumped score ${slumped.walkingScore}`)

let ignored = createLive(0)
ignored = takeStep(ignored, "R", 0)
assert.equal(ignored.events.length, 0)

console.log("scoring ok", careful, slumped)
