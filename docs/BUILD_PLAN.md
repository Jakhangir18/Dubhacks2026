# Build plan

Deadlines: **Devpost draft Sat 22:30** (all members added, tracks declared, or no judging); final submission **Sun 10:00**; judging Sun 11:30-14:00 in person.

## Roles (team of up to four)

| Role | Owns | First spike (pass condition) |
|---|---|---|
| Vision | Pi camera, pose, gait events | on the real walking pad, a strike for every step and a lift above 10 cm only when the walker lifts on purpose |
| Game | engine, renderer, art, projector calibration | three-lane loop playable with the keyboard; projector corners land on the pad outline |
| Hardware | mounts, stripes and belt meter, footstep sensors, stop button, safety rail | belt speed within about 10% of the pad's display; piezo test: one pulse per heel strike, left and right told apart |
| AI and Visa | coach prompt and rules, voice, report, league, Visa sandbox, Devpost | coach returns a valid cue and parameters; a sandbox payment or payment link is created |

## Timeline

| Time | Milestone |
|---|---|
| now to +1 h | buy the projector and parts ([research/hardware.md](research/hardware.md)); create the Visa sandbox account; read the Hacker Guide sponsor briefs |
| +1 h to +4 h | the four spikes above |
| +4 h to 22:00 | integrate: events into the game, game on the projector, coach loop |
| 22:00 | Devpost draft submitted with tracks (do not miss it) |
| night | report card, family league, payout, art, sound |
| Sun 07:00-09:30 | demo video for video-judged side tracks, rehearsal, freeze |
| Sun 10:00 | final submission |

## Demo checklist

- Support rail installed, speed capped, one teammate beside the pad, stop button in reach.
- Projector focused, corners calibrated, venue light tested; screen mode ready as fallback.
- Keyboard mode ready if the camera fails; mock payout ready if the network fails.
- 90-second script rehearsed (see [GAME_DESIGN.md](GAME_DESIGN.md)).

## Risks

| Risk | Mitigation |
|---|---|
| Camera misses steps on the moving belt | side view, coloured shoe tape, calibrate on the real pad first; piezo timing as backup |
| Projector washed out by hall lighting | brighter projector, dark game art, screen mode fallback |
| Judge falls | low speed, support rail, spotter, stop button |
| Visa sandbox credentials late | create the account now; labelled mock as fallback |
| Medical claims | say "training game modelled on published trials", never "treats" or "prevents falls" |
| Trademark | own names and art; no Plants vs. Zombies assets |
