# Zombie Walk Home — family dashboard

The browser dashboard for Zombie Walk Home: tonight's walk, the path of gardens home, progress, past walks, and Maya, the AI therapist. A projector paints a night garden on the floor, a camera scores each step, and Gus the zombie has to shuffle home before sunrise.

The dashboard uses the game's night palette and sticker cards, art and a looping hero clip generated with Higgsfield, and motion built on `motion` plus Magic UI / 21st.dev pieces (number ticker, particles, blur fade). Every animation turns off under the system "reduce motion" setting.

The form round stands in for the projected floor: two short waves that score the same cues.

## Run the dashboard

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## What you can do

- Start today's goal from the overview, or pick any open goal on Play & practice. The walk is always stomping plants.
- Walk the form round with the buttons or the keyboard: `A` / `←` left foot, `D` / `→` right foot, space to stand tall. Turn on the metronome if you want the beat.
- Score 80 on the planned goal to open the next one. XP, the streak, and the walking score update from the round.
- Review scores and the weekly minute goal on My progress. Open any past walk from Sessions.
- Ask Maya about pace, symmetry, or the plan. Pain and injury go to Contact care team, not to her.
- Open the movement kit to see the camera, trackpad, and projection, or mark a sensor offline and run a connection check.

Practice data stays in this browser. Reset it from Jordan's profile.

The existing game tests still run with `npm test`.

---

# Stride Defense (working name)

**An AI therapist-style coach that turns the exercises a therapist assigns into a projected game kids actually want to play.**

DubHacks '26, University of Washington, Oct 17-18 2026.

## The problem

- About 1 in 345 US children has cerebral palsy (CDC), and 5% to 6% of school-aged children have developmental coordination disorder (CMAJ 2015). Many more children and teens are given movement exercises after sports injuries.
- Therapy happens mostly at home, and home programmes fall apart: across 13 studies, 34% to 79.2% of parents of children with cerebral palsy did not keep up the home exercise programme (PLOS ONE 2024).
- Access is thin: in one US region only 14% of the physical therapy clinics that answered a survey took children with Medicaid-type insurance (JPOSNA 2024).
- Games help movement skills when they are part of therapy: active video games improved gross motor skills in children with developmental disabilities (12 trials, g = 0.833; the authors ask for caution).

Sources and more numbers: [docs/research/kids-evidence.md](docs/research/kids-evidence.md).

## The solution

A projector paints a garden on the floor; the child is a zombie walking through it.

- **Step on the sunflowers** with the right foot: step placement and coordination.
- **Lift your foot when a cactus spits at it:** foot clearance and balance, measured in centimetres.
- **Answer the sign out loud** while moving: dual-task practice.

An **AI coach with a therapist's rules** watches through a camera (a laptop webcam or an iPhone), gives feedback on every step at first and fades it slowly, speaks one short cue at a time, and adapts the game only inside limits the child's therapist sets. Parents get a report after every session; a family reward pool turns completed sessions into rewards paid through Visa.

## Two modes

| Mode | Who | Where | Why |
|---|---|---|---|
| **Floor** (core) | children | targets projected on a firm floor or a white mat | no moving parts; walking-pad manuals tell children to keep away |
| **Walking pad** (optional, supervised) | teens and adults within the pad's rated age (14+ on KingSmith manuals) | targets on a screen or wall in front, not on the belt | the treadmill adds continuous walking practice |

## How a session works

1. The therapist (or a preset) sets the exercise plan and limits; a parent starts the session.
2. Ten-second calibration: stand still, take a few steps.
3. Play for about 15 to 20 minutes (a parent-run home programme dose for cerebral palsy averaged 16.5 minutes), then the game locks until the next session.
4. Report card for the parent and the therapist; the session counts toward the family reward.

## Repository map

| Path | What |
|---|---|
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | mechanics, the coach, rewards, demo |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | hardware decisions, layout, data flow, interfaces |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | roles, first spikes, timeline, risks |
| [docs/SPONSORS.md](docs/SPONSORS.md) | tracks we enter and how each sponsor's tech is used |
| [docs/research/](docs/research/) | research briefs in English and Russian (`*.ru.md`) |

## Tracks

Title track: **Community Kitchen** (accessibility, healthcare, community support). Side tracks: Visa (parent-funded rewards; the 2025 DubHacks Visa winner was a kids' habit app with parent-controlled rewards), CloudForce Most Viral, and SideShift or DubHacks Next, plus MLH Best Use of Gemini API. Details in [docs/SPONSORS.md](docs/SPONSORS.md).

## Safety, privacy and claims

- A tool for the therapist and the family, not a replacement for therapy and not a medical device. Product wording stays inside the FDA general wellness terms: coordination, balance, strength, endurance, general mobility. No disease names or recovery claims in the app.
- Children play on the floor, never on the walking pad. Teens and adults use the pad only with a person beside them, low speed and a stop button.
- Camera video stays on the device; only step numbers leave it. Under COPPA a child's video and movement patterns count as personal information.
