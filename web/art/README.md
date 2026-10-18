# The garden of Grandma Rosa

All 28 SVG assets are original, made by Codex for Zombie Walk Home. No borrowed characters, artwork, fonts, external resources, filters, or gradients. Each SVG is self-contained, with saturated flat fills and chunky dark outlines.

| Asset | Design |
| --- | --- |
| `gus-idle.svg` | Gus, idle pose |
| `gus-step.svg` | Gus, step pose |
| `gus-celebrate.svg` | Gus, celebrate pose |
| `gus-portrait.svg` | Gus progress portrait |
| `flower-marigold.svg` | Marmalade, the grumpy marigold |
| `flower-bell.svg` | Ding-Dong, the sulky bell blossom |
| `flower-rose.svg` | Rosie Ruffles, the bossy rose |
| `pod.svg` | Pip, the hiccuping seed pod |
| `seed.svg` | Bouncy pink seed ball |
| `foot-r.svg` | Right footprint with forward arrow |
| `foot-l.svg` | Left footprint with forward arrow |
| `tile-grass-light.svg` | Grass light board tile |
| `tile-grass-dark.svg` | Grass dark board tile |
| `tile-dirt.svg` | Dirt board tile |
| `tile-stone.svg` | Stone board tile |
| `tile-puddle.svg` | Puddle board tile |
| `tile-cracked.svg` | Cracked board tile |
| `tile-target.svg` | Target board tile |
| `house.svg` | Gus’s crooked cottage with a glowing porch |
| `fence.svg` | Chunky three-post garden fence |
| `tree-lime.svg` | Lime lollipop tree, overhead canopy |
| `tree-teal.svg` | Teal lollipop tree, overhead canopy |
| `moon.svg` | Sleepy crescent moon and a star |
| `cloud-puff.svg` | Cloud puff |
| `cloud-long.svg` | Cloud long |
| `petal.svg` | Golden petal particle |
| `spark.svg` | Four-point sparkle particle |
| `goo.svg` | Mint goo particle |

The seven tile designs are decorative: only the highlighted target row indicates where to act. Dirt pads follow plants at their exact rule-defined distance; decoration never moves the scoring window.

Art is loaded locally by the Preload scene using `this.load.svg`. If an individual SVG fails, `makeTextures()` supplies its procedural fallback. Textures are rasterized once at load time. Play uses 20 recycled board tiles, two target tiles, and at most 80 live particles across three capped emitters. Home caps particles at 36.

The game uses Phaser’s Canvas renderer: the sprite set needs no WebGL effects, leaving GPU resources available for pose estimation. Foot urgency is drawn as a colored rim so it also works in Canvas.

## Generated art (concept E, 2026-10-18)

`hd/*.png` are generated with Higgsfield (style sheet on `nano_banana_pro`, sprites on `gpt_image_2_5` with transparent backgrounds) from the style reference in `docs/ART_DIRECTION.md`, then scaled to twice their game size. The game draws each one into the box of the SVG with the same name and keeps the SVG as the fallback.

## Three-round story

- `gus-walk-sheet.webp`: the supplied `out/game-anim/gus-walk-sheet.png`, encoded as WebP at quality 86. Original 1536×1024 layout, 6×4 cells of 256×256, 24 transparent frames at 8 fps. Canvas mirrors the left-facing source toward the house.
- `maya-cartoon.webp`: copied from the dashboard's supplied portrait. Its opaque background is contained in a round cameo at the door.
- `spitter.svg` and `spikeweed.svg`: original vector targets, with thick outlines and bright green/gold silhouettes. Both use the existing flower rules; the spitter's peas are decoration only.

The full-window garden uses the existing HD scenery, cached into two canvases (garden and intro panorama) on load and resize. No remote assets or animation libraries are required.
