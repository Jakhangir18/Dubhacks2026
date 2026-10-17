# Stride Defense (working name)

**An AI therapist-style coach that turns any home treadmill into balance and walking training, gamified with a projector.**

DubHacks '26, University of Washington, Oct 17-18 2026.

## The problem

- More than 14 million US adults aged 65+ fall every year, and the fall death rate rose 21% from 2018 to 2024 (CDC).
- The training that works is known: treadmill walking with obstacles to step over cut falls by about 42% in the V-TIME trial (The Lancet, 2016), and step training roughly halves the rate of falls (meta-analysis of 7 RCTs).
- People do not get it: the clinical systems live in clinics, and only about 21% of people given home fall-prevention exercise do the full dose.
- A game alone is not enough: an unsupervised home stepping game failed in a randomized trial in Parkinson's disease. The missing piece is a therapist watching every step.

Sources and more numbers: [docs/research/evidence.md](docs/research/evidence.md).

## The solution

You walk on a walking pad. A projector above it paints a garden on the moving belt; you are the zombie walking through it.

- **Step on the sunflowers** with the right foot: step placement and step length training.
- **Lift your foot when a cactus spits at it:** obstacle clearance training, measured in centimetres.
- **Answer the sign out loud** while walking: dual-task training.

An **AI therapist** watches through a camera, speaks one short cue every 20 to 30 seconds ("lift your left foot like stepping over a curb"), adapts the game to you, and writes a report for your family and your clinician. A **family league** turns verified sessions into rewards paid through Visa.

## How a session works

1. Set a slow speed on the treadmill remote. Calibrate for about 10 seconds: stand still, take a few steps.
2. Play. Plants scroll with the belt at its measured speed. Points count only while the camera sees you really walking.
3. The coach adapts difficulty and suggests speed changes; you press the remote.
4. Finish: a report card (distance, hit rates, lift height per foot, trend) and a verified session in the family league.

## Repository map

| Path | What |
|---|---|
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | mechanics, the therapist, the family league |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | hardware layout, software components, data flow, interfaces |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | roles, first spikes, timeline, demo script, risks |
| [docs/SPONSORS.md](docs/SPONSORS.md) | which tracks we enter and how each sponsor's tech is used |
| [docs/research/](docs/research/) | research briefs in English and Russian (`*.ru.md`) |

## Tracks

Title track: **Community Kitchen** (healthcare, accessibility, community support). Side tracks: Visa (family reward pool), CloudForce Most Viral, and SideShift or DubHacks Next, plus MLH Best Use of Gemini API. Details in [docs/SPONSORS.md](docs/SPONSORS.md).

## Safety and claims

This is a wellness training game modelled on published trials, not a medical device. It does not diagnose, treat or prevent disease. Under the FDA's general wellness guidance (January 2026), claims such as improving coordination, multitasking and general mobility are wellness claims, while a claim to restore a function impaired by injury or disease is not. So the product and the pitch talk about balance, coordination and walking confidence; injury rehabilitation under a clinician is future work, not a demo claim. Details: [docs/research/therapist.md](docs/research/therapist.md).

Walking pads have no handrails: use a support rail next to the pad, keep speeds low, keep a person beside the walker, and screen every player with the PAR-Q+ questionnaire before a session.
