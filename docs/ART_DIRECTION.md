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

- **Gus**: a small friendly zombie kid in purple pyjamas and fuzzy slippers, green skin, one stitched patch, huge round eyes, one buck tooth, messy dark hair tuft. He must get home to bed before sunrise.
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
