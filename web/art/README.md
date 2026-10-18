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
