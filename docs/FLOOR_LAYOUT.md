# Zombie Walk Home: layout for a small walking pad

Design plan for the projected floor game on the THERUN pad with the Vankyo Leisure 3W. Rules in `web/logic.js` stay unchanged; everything here is presentation. Mockups: `mockup-1.png` (act 2 play), `mockup-2.png` (act 3 feedback), `mockup-3.png` (Home card).

## 1. Constraints and measurements

### Assumptions (owner, please measure)

| Item | Assumed | Measure |
|---|---|---|
| Belt | 40 x 100 cm, dark grey rubber | belt size and colour (a black belt reflects about 5-10% of the light) |
| Deck | 55 x 130 cm, side rails about 7 cm each | deck size, rail width and colour |
| Toe line | toes 45 cm from the rear end of the deck when walking | where the toes really are while walking (tape a mark) |
| Projector | lens 1.0 m above the floor, 1.0 m in front of the pad, aimed down | lens height, horizontal distance lens to pad front edge |
| Projector output | native 800 x 480, 16:10, throw ratio 1.53:1, 2000:1 contrast, vertical keystone only ([ProjectorCentral](https://www.projectorcentral.com/vankyo-leisure_3w.htm)); real brightness 60-150 ANSI lumens (retailers quote 65 ANSI, the box quotes "3600 lux") | nothing; design for 60 lumens |
| Player | teen or adult, eye height 1.55 m, walks at 80-120 steps per minute | nothing |
| Room | dark, under 1 lux ambient | turn off every light; a phone screen facing the floor already matters |

The game canvas is 720 x 1280 and is warped by homography into the four marked corners; the warp is correct for any trapezoid, so the zone does not have to be the pad.

### Where the light lands and what the legs hide

- The projector is in front of the player, so light arrives at a low angle from the front. A shin 40 cm high lit at 26 degrees elevation (lens 1.0 m up, 2.05 m away) casts a shadow 82 cm long behind the toes. A lifted knee makes it longer. **Nothing behind the toe line is ever visible.** The current setup copy ("back corners under your feet") puts a quarter of the field in that shadow.
- In front of the toes there is no shadow at all: the player's own body never gets between the lens and the floor there.
- Illuminance falls with distance squared and with the grazing angle. For the portrait setup below the floor at the toes receives about **1/14** of the light the floor 0.7 m in front of the projector receives. The pad end near the toes is the darkest part of the image; the floor between projector and pad is the brightest.
- On a dark belt (reflectance about 0.1) that dim end gives roughly 0.5 cd/m2 for white. Visible in a dark room, but only for big, simple, bright shapes. On a white mat the same light gives about 5 cd/m2.

### Where the eyes are

Eye height 1.55 m, standing at the toe line:

| Floor point ahead of the toes | Gaze below horizontal | 1 degree on the floor | Foreshortening along the lane |
|---|---|---|---|
| 0.3 m (on the belt) | 79 deg | 2.8 cm | 0.98 |
| 0.85 m (pad front edge) | 61 deg | 3.1 cm | 0.88 |
| 1.5 m (floor in front) | 46 deg | 3.8 cm | 0.72 |
| 2.2 m (floor, HUD area) | 35 deg | 4.7 cm | 0.58 |

A walker on a treadmill naturally looks 0.8-1.5 m ahead (45-60 degrees down). Looking at the belt right in front of the toes (79 degrees) means bowing the head; people will not hold that for 16 minutes. **The hit line therefore belongs at the pad's front edge or beyond, not under the feet.** The rules allow this: `judge()` compares a lift event time to `arriveT`; it never checks where the foot lands.

### Projector pixels on the floor

Landscape (as today): the 480-pixel axis runs along the floor. With the lens 1.0 m up aimed at the pad, the picture covers roughly 1.05-2.67 m from the lens: the pad gets about 350 x 240 projector pixels and only 15 cm of floor in front of the pad is left for the HUD. That is why the HUD is squeezed to the side in the screenshots.

**Portrait (recommended): put the projector on its side** so the 800-pixel axis runs along the floor. Half field of view along the floor is 18 degrees; with the far ray at 20 degrees the picture covers 0.67-2.75 m from the lens: 2.1 m of floor, 0.6-1.0 m wide. The pad gets about 300 x 280 projector pixels and there are about 0.9 m of bright floor in front of the pad for the garden and the HUD. The laptop display is rotated 90 degrees in the OS; the warp handles the rest. Needs a stand that holds the projector on its side (a book and a strap are enough for the demo).

Consequences for art, in game pixels (720 x 1280 canvas over a zone about 55-80 cm wide and 185 cm long, see Layout):

| Thing | Minimum | Why |
|---|---|---|
| Any stroke or outline | 12 px | one projector pixel is 2.5-5 game pixels; a 6 px line aliases to nothing at the dim end |
| Any sprite the player must react to | 200 px across (about 18 cm, 5-6 degrees) | reads in peripheral vision at a glance while walking |
| Hit line | 48 px thick, full lane width | brightest thing on the floor, at the darkest end of the pad |
| Text inside the field | none during play | text on the belt is dim, foreshortened and under the flowers |
| HUD text on the front floor (DOM, screen pixels) | act title 72 px, coach line 48 px, score 64 px, pace line 22 px (operator only) | cap height about 10 cm at 2.2 m, which foreshortens to 1.3 degrees; the pace line is never read by the player |

Colour at 60-150 lumens on a dark belt: an LED projector's luminance is mostly green. Relative brightness of the palette at the same drive: lime `#9cff5a` 0.85, cyan `#2de2c4` 0.7, marigold `#ffb21e` 0.6, seed pink `#ff5fa2` 0.45, rose `#ff3d8b` 0.4, bell violet `#a46bff` 0.3. **Violet and pink things are three times dimmer than lime.** Rule: colour tells identity, a white or lime ring tells presence. Every flower and seed gets a lime halo as it nears the hit line (the ring exists already; it just needs to be brighter and larger). The bell flower gets a lighter violet (`#c9a4ff`) and a white petal rim. Red is useless as a warning colour here; "miss" uses amber `#ffb21e` and a shape change, not red.

Motion: the belt moves at 60-110 cm/s under the image. Anything with texture that stands still on the belt looks like it is sliding backwards. So on the belt only lines, glows and silhouettes stand still (hit line, footprints, lift meters); the lawn checker always scrolls. The world scroll (`speed` in `step()`) is 67-100 cm/s in world units, which maps to only 16-24 cm/s on the floor in the layout below, so the floor scroll is calm; the plants are what the eye follows.

### Time to react (unchanged rules)

| Cadence | World speed | Spawn to arrival (`aheadCm` 420) | Between things (`spacingCm` 140) | Lift window |
|---|---|---|---|---|
| 80 spm | 67 cm/s | 6.3 s | 2.1 s | 0.95 s (`beforeS` 0.6 before, `afterS` 0.35 after) |
| 100 spm | 83 cm/s | 5.0 s | 1.7 s | 0.95 s |
| 120 spm | 100 cm/s | 4.2 s | 1.4 s | 0.95 s |

At 100 spm a step takes 0.6 s, so the window holds about one and a half steps: the player must lift the named foot on its next swing. A knee lift takes about 0.3 s to peak. So the cue "lift now" must fire 0.6 s before arrival (the start of the window), and an "attention" cue about 1.4 s before (the current `near > 0.72` ring, 118 cm out). Both exist in the code as timings; they only need to be made visible at the right place and size.

## 2. Layout

### The zone

Mark the zone as a trapezoid **from 1.0 m in front of the pad to the toe line**: back corners at the toes, 55 cm apart (the deck edges); front corners on the floor 1.0 m beyond the pad front edge, about 80 cm apart. Length about 185 cm. The pad is the rear 46% of the field, the floor the front 54%. Pixel density: 6.9 game px per cm along the lane, 9-13 across. Compensate the anisotropy with one constant: draw lane sprites with `scaleY` 1.25 (a round seed on the canvas then lands as a slight oval on the floor, which the player's 45-60 degree view shortens back to a circle).

Canvas regions, y in the 1280-high field (0 = far, 1280 = toes):

| y range | Floor | What is there | Moves? |
|---|---|---|---|
| 0-110 | floor, farthest | Pip pods (act 3), act 2 flower-bed border; spawn point | static |
| 110-690 | floor in front of the pad, 100 cm | the two lanes, flowers and seeds approaching | lawn scrolls, things scroll |
| 690 | pad front edge, 85 cm ahead of toes | **hit line**, 48 px white-lime, chevrons pointing at the player | static, pulses |
| 690-1150 | belt | lanes continue dim (40% brightness); squashed flowers and goo blots slide under the feet; the glow ring of the next thing is drawn here only as a big halo | scrolls |
| 1150-1280 | belt at the toes | two ghost footprints, 180 x 240 px, 30% alpha; amber metronome when the pace gate is shut | static |
| rails, x 0-98 and 622-720, y 690-1280 | deck rails, 7 cm | two lift meters, 60 px wide, filled from the toes upward, target tick in the kind's colour; white flash on a lift that reaches the tick | static |

Lanes: x centres 229 and 491 (belt 40 cm = 524 px centred, two lanes of 262 px), 20 px dark gap between them so a thing's lane is never ambiguous. On the floor part the lanes keep the same x so the eye follows a straight path.

### Outside the zone (ambient canvas and DOM HUD)

With the portrait projector the floor in front of the zone is about 0.9 m deep and the full picture width. Everything that is text or story goes there, which is where the player's natural gaze already rests:

- **Banner** (DOM `#garden-hud`), centred just in front of the zone: act title on one line, coach line below it, score chip at the right end. Three lines maximum, nothing else. The pace line shrinks to 22 px in the bottom corner for the operator.
- **Path home** (ambient canvas): a curved path from the banner up to the cottage at the top of the picture. Gus walks along it as `progress` grows (0 at the pad, 1 at the porch). This is the progress bar; the DOM `<progress>` goes away. The house with its porch light is the one warm, bright thing at the far end and gives the walk a destination.
- Garden decoration stays on the sides but at 25% alpha: the sides are peripheral and bright clutter there competes with the lanes.
- The HUD gets `transform: scaleY(1.5)` so letters that are foreshortened at 35 degrees still read as upright letters from the pad.

### What is on the belt and what is on the floor, and why

- Floor in front (bright, dense pixels, 45-60 degree gaze): approaching things, hit line, Pip, banner, path, house. This is the whole game.
- Belt (dim, sparse, 60-80 degree gaze): only the aftermath and the static markers. Nothing the player must read; nothing that scrolls with texture except the lawn, which is dimmed.
- Behind the toes: nothing; the canvas ends there.

Floor mode for children is the same picture on a white mat: the child stands at the back corners, the "pad" part is the rear of the mat. Because the floor is white, the belt dimming constants are not needed; `?floor=1` can switch the belt brightness to 100%.

## 3. Feedback

Every event has one shape change, one colour and one sound, big enough to read in the lower half of peripheral vision while looking at the banner.

| Event | On the floor | Reason |
|---|---|---|
| Thing 1.4 s out (`near > 0.72`) | lime halo ring 300 x 180 px under it, 60% alpha, pulses at 3 Hz; the matching lift meter's tick lights | the "attention" cue, in the same lane as the foot |
| Window opens (0.6 s before arrival) | ring turns white at 100%; hit line flashes once in that lane half; a 0.95 s shrinking arc shows the window closing | tells the player "lift now" and how long they have |
| Stomp hit | flower squashes flat (existing tween), petals burst, the lane half flashes lime for 0.2 s, SMASH! appears in the banner in yellow for 1.2 s | the squash already reads well; the lane flash makes it visible without looking at the plant |
| Stomp miss | flower stays upright, slides under the feet with a wobble; lane half dims to amber for 0.4 s; banner says HIGHER STEP in amber | amber, not red: red is the dimmest colour on this projector |
| Dodge hit | seed bursts into a cyan ring 400 px that expands and fades; camera flash stays; banner DODGED! in cyan | cyan is bright and is the only cyan event, so it means "dodge" alone |
| Dodge miss | pink goo blot 260 px stamped on the lane, scrolls under the feet; short shake stays; banner SPLAT in pink | the blot lingering on the belt is a visible record, like the squashed flower |
| Streak 5 (x2) | score chip turns gold and grows 20%; hit line gets a gold shimmer | one glance tells the player the multiplier is on |
| Pace gate shut (`pace.ok` false) | lanes dim to 40%, hit line turns amber and breathes at 1 Hz, the two toe footprints light alternately at 100 spm (left, right, left), banner reads KEEP WALKING in amber | the alternating footprints are a metronome, they show the pace wanted, not only that it is wrong; current full-screen dim is too subtle at 60 lumens |
| Paused | everything at 50%, banner PAUSED | unchanged |
| Act change | banner swaps with the act title for 4.4 s (existing `actIntroUntil`), the hit line flashes white twice, lane border accent changes colour: act 1 lime, act 2 marigold, act 3 seed pink; act 3 slides the two Pip pods in from the top | the player notices the colour of the whole picture change without reading |
| Home | lanes fade to dawn; Home card on the floor; Gus reaches the porch | unchanged, see Screens |

The current lift meters sit beside the pads under the feet, where they are invisible. On the rails they are static, beside the lane they belong to, and halfway up the pad where the gaze passes.

## 4. Screens

### Setup (zone marking)

- Instructions move to the top of the picture in the same 48 px style: "Back corners at your toes. Front corners on the floor 1 m past the pad. Stand on the pad to check: the glowing line must be at the pad's front edge."
- The preview (`ZonePreview`) draws the new layout exactly: lanes, hit line at y 690, ghost footprints, rail meters, three flowers scrolling, so the owner can judge the line's position with their own eyes while dragging.
- A second check: after Done, the preview stays 3 s with the text "Walk. Is the line in front of your toes?" This catches the shadow problem before the game starts.

### Title

- Zone: lanes idle, lawn scrolling slowly, hit line breathing, footprints at the toes pulsing alternately: this is a silent "walk in place to start" cue that works even with the sound off.
- Front floor: ZOMBIE WALK HOME in the banner, "Walk in place to start" below, Gus idle at the foot of the path, house at the top with the porch light on.
- No title text inside the field (today it is small, foreshortened and partly under the fence art).

### Act 1, Bedtime, Gus!

- Nothing arrives. The lanes scroll, the hit line breathes. The only task is pace.
- The progress is Gus walking the path; the banner shows the hint. When `pace.ok` drops, the KEEP WALKING state above. This act also measures the normal step height; the rail meters show each step as a small cyan bump so the player sees the game watching their feet.

### Act 2, Petal Patrol

- Flowers appear at the far end, one per lane at a time, and march down. A flower-bed border (`bed-strip`) runs along the far edge to say where they come from.
- Hit line, halos, window arc, squash, SMASH!/HIGHER STEP as above.
- Act accent: marigold.

### Act 3, Pip's Hiccups

- Pip sits at the top of each lane, squashes on each hiccup (existing tween), the seed rolls down with a rotation and a short motion streak so it is seen in the periphery.
- Dodge ring, goo blot, DODGED!/SPLAT as above. Act accent: seed pink. The window arc is pink.

### Home card

- The card is drawn on the belt part of the field (y 700-1250), where nothing moves any more, with the dawn lawn around it. The player has stopped and now looks straight down: the belt is the right place for one big readable card, but keep the letters at 64 px and above.
- Rows: HOME BEFORE SUNRISE!, the score in 120 px numerals, then four pictogram stats (marigold 75%, seed 70%, left boot 13 cm, right boot 11 cm), then the coach note in cyan, two lines maximum. Pictograms replace the current sentences: "High steps left 13.5 cm right 11 cm" is not readable at 26 px on a dark belt.
- The QR goes to the **front floor**, on a cream tile 300 x 300 screen px, next to the house: it must be scanned by a phone held by a standing person, and the floor in front of the pad is the bright, undistorted, unshadowed place. On the belt the QR would be dim and sheared.
- Gus celebrates on the porch at the top; the path is complete.
- "Press R to walk again" at the bottom of the banner, 36 px.

## 5. Assets

Keys follow `web/art/`; sizes are the canvas box in game pixels. All PNG, transparent, one object, no shadow.

| Key | Size | Description | Why |
|---|---|---|---|
| `hit-line` | 720 x 96 | a thick white-to-lime glowing bar with six small chevrons pointing down and soft outer glow | the brightest static object; drawn with Graphics today, too thin (6 px) |
| `halo` | 320 x 200 | an ellipse ring, lime, soft edge, white inner rim | replaces the ellipse stroke; a soft-edged ring survives projector blur better than a hard stroke |
| `window-arc` | 320 x 200 | a 270-degree arc, white | drawn with Graphics (arc angle = time left in the window); the asset is optional |
| `foot-ghost-l`, `foot-ghost-r` | 180 x 240 | the existing foot prints as a white outline silhouette only | the current green-filled pads disappear on the belt; a white silhouette reads at 1/14 light |
| `meter-rail` | 60 x 560 | a rounded dark tube with a cyan fill mask and a white tick | lift meters on the rails |
| `flower-bell` (recolour) | 128 x 128 | same shape, petals `#c9a4ff` with a white rim | violet is the dimmest palette colour |
| `goo-blot` | 260 x 180 | a pink splat with a thick outline | miss record on the belt |
| `seed-streak` | 64 x 160 | a soft pink tail | motion cue for the seed in peripheral vision |
| `bed-strip` | 720 x 110 | a flower-bed edge, dark soil with a few leaf tops | act 2 spawn edge |
| `path-home` | 900 x 700 (ambient canvas) | a curved cobble path with a dark background, cottage at the top with the porch glow | the progress bar as scenery |
| `gus-walk-side` | 160 x 192 (2 frames) | Gus walking seen from the side, slippers | walks the path; current frames face the camera |
| `qr-tile` | 340 x 400 | cream rounded tile with "scan for your clip" lettering area | the QR needs a light surround to be scanned on a dark floor |
| `stat-marigold`, `stat-seed`, `stat-boot-l`, `stat-boot-r` | 96 x 96 | pictograms | Home card rows |

Not needed any more: `tile-target` (the hit line replaces the target tiles), the DOM `<progress>`.

## 6. Code changes ranked (impact first)

Hours are for one person who knows the code; verify each on the pad, not only in the screenshot script.

1. **Zone semantics and hit line position** (`game.js` `layout()`, `yFor()`, `drawWorld`; `index.html` setup copy; `ZonePreview`), 3 h. `zoneY = H * 0.54`; `top = H * 0.085`; lanes x at `W * 0.318` and `W * 0.682`, width `W * 0.364`; belt rows continue below `zoneY` at 40% alpha (`setAlpha` on tiles whose y > zoneY); feet move to y 1150-1280 as outline silhouettes; the preview draws the same layout. Setup copy: "Back corners at your toes, front corners 1 m past the pad." Largest effect: moves the game out of the shadow and into the comfortable gaze.
2. **Hit line, halo and window arc** (`game.js` `drawWorld`, `drawThings`, `drawHud`), 2.5 h. Draw `hit-line` at `zoneY`, 96 px tall; halo at `near > 0.72`, white at `th.distCm <= speed * RULES.beforeS` (compute `windowOpen = th.arriveT !== null || th.distCm <= out.speed * RULES.beforeS`), a Graphics arc from `g.t` to `arriveT + afterS`. Remove `targetTiles`.
3. **Lift meters on the rails** (`drawHud`), 1 h. `bx` at `W * 0.068` and `W * 0.932`, meter from y 1250 up to y 700, 60 px wide, tick colour by kind, white flash when `this.lift[lane] >= need`.
4. **Pace gate metronome** (`drawHud`, `ambient.js` frame), 1.5 h. When `!out.pace.ok && g.t > 3`: lanes alpha 0.4, hit line tinted `#ffb21e` with `0.5 + 0.5 * sin(2 pi t)`, footprints alternate at `g.limits.minCadence + 20` spm, banner text KEEP WALKING (the `#walk-prompt` already exists; make it the banner's middle line).
5. **Banner HUD on the front floor** (`ambient.js` `layout()`, `projection.css`, `index.html`), 2 h. Prefer the front region only (drop the side regions unless front height < 160 px); width up to 1000 px; `transform: scaleY(1.5); transform-origin: bottom center`; font sizes: `.hud-heading` 72 px, `#coach` 48 px, `#score` 64 px, `#pace` 22 px moved to a fixed bottom-left corner; hide `.home-progress`. Three lines maximum: clamp `#coach` to two lines with `-webkit-line-clamp`.
6. **Path home with Gus** (`ambient.js` frame, new `path-home` and `gus-walk-side` images in `ART`), 2.5 h. Draw the path between the HUD box and the house; Gus at `lerp(pathStart, porch, progress)` with a 2-frame walk at the cadence; `zombiewalk:pace` already carries `progress`.
7. **Feedback states** (`resolveFx`, `drawThings`), 2 h. Lane-half flash (a Graphics rect over the lane, alpha tween 0.6 to 0 in 200 ms), amber dim on miss, `goo-blot` stamp with `setDepth(4)` scrolling with `travelledCm`, cyan dodge ring 400 px, streak gold on the score chip, `seed-streak` child in the seed container.
8. **Act accents** (`showAct`, `drawWorld`), 1 h. Lane border colour by act, hit line double flash on `actChanged`, Pip pods tween in from y -120 to y 60 in act 3, `bed-strip` visible in act 2.
9. **Home card and QR placement** (`Home.create`, `layoutCard`; `ambient.js` for the front-floor QR), 3 h. Card on y 700-1250 with 64 px rows and pictograms; QR moves to a DOM `<img>` in the front region next to the house (the ambient canvas is not warped, so the QR stays square); keep `share.image` as the source; `shareText` under it at 36 px.
10. **Title and setup screens** (`Title.create`, `ZonePreview`, `index.html`), 1.5 h. Title text out of the field into the banner; idle lanes and breathing hit line in the field; a 3 s "walk, is the line in front of your toes?" check after Done.
11. **Sprite stretch and sizes** (`drawThings`, `PLANT_SCALE`), 0.5 h. Containers `setScale(1, 1.25)`; `PLANT_SCALE` 1.7 so flowers are about 215 px wide; seed scale 2.0 (130 px).
12. **Belt dimming switch** (`game.js` params), 0.5 h. `?floor=1` sets belt-part alpha to 1 for the white mat.

Total about 21 h. Items 1-5 (10 h) are the demo-critical set: without them the game is in the shadow, the line is under the feet and the text is unreadable from the pad.

Test on the pad after items 1-5: stand at the toe line, walk, and check that the hit line is visible at the pad front edge, that a flower at the line is seen without looking down, and that KEEP WALKING is noticed within 2 s when stopping.

## 7. Questions for the owner

1. Belt colour and finish? If it is black rubber, plan B: mark the back corners at the pad's **front** edge instead, so the whole field is on a white mat on the floor and the belt carries nothing. The rules do not care; the lift meters then move to the bottom corners of the field.
2. Can the projector stand on its side (portrait)? If not, the landscape fallback keeps today's side HUD, but the front floor shrinks to about 15 cm and the act titles must go to the sides at 48 px.
3. Lens height and distance to the pad front edge? These set the shadow length and the brightness ratio; both numbers go into the setup copy.
4. What resolution does the laptop send to the projector (1280 x 720 or 800 x 480)? The HUD font sizes above assume 1280 x 720 CSS pixels.
5. Toe position while walking, measured once with tape: it fixes where the back corners go and whether the 85 cm from toes to pad front edge holds.
6. Is a white mat available for the children's floor mode and as plan B for the demo?

## 8. Mockups: what to keep

Generated with Higgsfield (requested `nano_banana_pro`, the service reported `nano_banana_2` on the finished jobs), 9:16, 2k, 2 credits each, 6 credits total. Each is a picture of the full portrait projection: top = floor in front, bottom = toes.

### mockup-1.png (act 2 play)

Keep: the whole vertical order (house and path, banner, lanes, hit line, footprints); the banner at three lines with the score chip; the halo ring under the marigold at the line; the rail meters with a tick; the dark gap between lanes; the ghost footprints as faint silhouettes; the belt below the line left almost empty.
Change: the words HIT LINE must not be in the field (no text on the belt, and the line itself is the signal); the chevrons on the line should point at the player, not up; Gus and the house are too far from the banner (the path should start at the banner's top edge so the progress reads as one object); the meters sit too high, they should start at the toe line and end at the hit line.

### mockup-2.png (act 3 feedback)

Keep: Pip at the top of each lane with hiccup bubbles; the cyan sparkle ring with DODGED! in the lane; the pink goo blot with SPLAT; the amber-tinted lane for the missed side; the seed's motion streak; the gold score chip with x2.
Change: the amber tint should fade in 0.4 s, not stay for the whole lane (as drawn it looks like a permanent mode); the progress bar beside the path is a good fallback but Gus walking the path (mockup 1) is clearer; feedback words should be drawn in the banner, not in the lane, where they land on the belt in the dimmest part; the hit line should be white-lime, not white with green text.

### mockup-3.png (Home card)

Keep: the card proportions and the 4 pictogram stats with values beneath; the huge score; the two-line cyan coach note; the QR on a cream tile beside the house on the bright front floor with SCAN FOR YOUR CLIP; Gus celebrating on the porch; the dawn gradient only at the top; the soft hit line and the dimmed lanes; the single bottom line PRESS R TO WALK AGAIN.
Change: the card should sit on the belt part (lower) so it is not between the player and the QR; the footprints at the bottom are far too large and bright for the dim end (keep the 30% outline version); the lanes in front of the pad can fade out more to give the QR tile dark surroundings for the phone camera.
