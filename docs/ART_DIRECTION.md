# Art direction: Zombie Walk Home

The single style reference for every generated or drawn asset. Prompts for image models quote this file; change the style here, not in a prompt.

## Where the art is seen

- A Vankyo Leisure 3W projector (about 150 lumens) throws the game onto a walking pad and the floor around it, in a dark room.
- Black projects as no light at all, so the background of everything is near-black night. Only the things that matter glow.
- The game field is portrait 720 x 1280, warped onto the pad; one game pixel is roughly 1.5 mm on the floor. Detail smaller than about 8 px disappears; shapes must read from 2 m away.
- Floor objects (flowers, seeds, tiles, footprints) are seen from above, slightly tilted (top-down three-quarter view), because they lie on the floor under the player's feet.

## Look

- Owner's choice (2026-10-18): the casual lawn-defense cartoon genre, the look players know from Plants vs. Zombies, but every character, shape and prop is our own. Never copy PvZ characters (Peashooter, Sunflower, Wall-nut, its zombies), its logo, fonts or UI.
- Bright checkerboard lawn in two greens for the lanes, chunky rounded cartoon plants with big expressive eyes and personality, a goofy lovable zombie kid, soft cel shading with a clear highlight, a thick dark outline on every character.
- Kid-friendly and funny, nothing scary or gory.
- Projector rule still holds: everything outside the lawn and props is near-black, so the bright lawn and characters carry the light; no fine texture, no thin lines, no text inside images.

## Concept art (owner's pick, 2026-10-18)

The owner's concept picture is the target look: a picket fence and a vegetable garden down both sides, the house at the top, two lanes, the hit line. These files are cut from it (Pillow, keyed by colour distance):

| File | Used for |
| --- | --- |
| `web/art/gus-pvz.png` | Gus in every pose (`gus-idle`, `gus-step`, `gus-celebrate`); the back slipper, hidden by a banner in the concept, is a copy of the front one |
| `web/art/fence-left.png`, `web/art/fence-right.png` | the space left and right of the lanes, on the field, in the zone preview and on the title; stacked from the clean upper part of both concept edges, darks lifted for the projector |
| `web/art/home-view.png` | the house view across the top of the title, the zombie and the progress bar painted out; the game's own flowers stand in a bed in front of it |

The space beside the lanes belongs to the fence strips: the lift meters are off (`SHOW_METERS` in `web/game.js`).

## Palette

| Role | Hex |
| --- | --- |
| Night background | `#070b10` |
| Path and lane base | `#14242a` |
| Glow lime (grass, Gus skin) | `#9cff5a` |
| Teal (trees, accents) | `#2de2c4` |
| Marigold orange | `#ffb21e` |
| Rose pink | `#ff3d8b` |
| Bell violet | `#a46bff` |
| Seed pink | `#ff5fa2` |
| Warm moon and porch light | `#ffd76a` |
| UI cyan | `#2de2ff` |
| Outline | `#0b1a14` |

## Cast

- **Gus**: the cartoon zombie of the concept art (`web/art/gus-pvz.png`): bald grey-green head with a few hair strands, huge round eyes, open mouth with square teeth, rumpled purple pyjamas with a torn patch, fuzzy purple slippers, shuffling along. He must get home to bed before sunrise.
- **Grandma Rosa**: never seen, only her garden and her missing slippers.
- **Marmalade**: a grumpy marigold, orange petals, furrowed brow.
- **Ding-Dong**: a sulky violet bell blossom, pouting.
- **Rosie Ruffles**: a bossy pink rose, hands-on-hips attitude in petal form.
- **Pip**: a round green seed pod with hiccups; it spits bouncy pink seed balls.
- **Gus's cottage**: crooked, purple roof, warm glowing porch light.

## Asset rules

- Sprites: one object, centred, transparent background, PNG, no ground shadow baked in, small even margin.
- Backdrops: no characters, no text, black or near-black where nothing should light up.
- File names keep the existing keys in `web/art/` (for example `gus-idle`, `flower-marigold`, `seed`) so the game swaps art without code changes.
