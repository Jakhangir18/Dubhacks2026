# web

## Play the game

With the server (needed for the Raspberry Pi bridge; the AI coach and saving come next):

```bash
python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt     # once, from the repo root
.venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000   # on the laptop: phones and the Pi reach it on the LAN
# open http://localhost:8000 in Chrome on the projector window, press F
```

Without the server (keyboard and camera still work): `cd web && python3 -m http.server 8000`.

## Set up on the pad

Put the projector and camera **in front of the player**. The player faces them while walking. Use the floor in front and beside the pad for the garden; nothing should project behind the player. Connect the speaker and press **F** for fullscreen.

1. On a new laptop, **Mark your walking zone** opens first. **Z** (or **C**) reopens it later. The bright outer outline is the whole projector frame.
2. Drag **FRONT-LEFT**, then **FRONT-RIGHT** to the end closest to the projector and camera. Then place **BACK-RIGHT** and **BACK-LEFT**. Left/right are the player's while facing the front. Preview plants travel from the front toward the footprints.
3. Use **Rotate 90°** for a projector mounted at the side. Arrow keys adjust a focused handle; Shift makes larger adjustments. Leave generous space in front of the zone for the large game text.
4. **Enter** or **Done** saves and continues to the title; explicit `?scene` previews still open their requested scene. Saved corners skip setup and stay compatible with `calibrate.html`. During a game, setup pauses play and the clip, then resumes them on Done. **K** shows the normally hidden keys bar.

## Therapist and parent panel

Open http://localhost:8000/therapist.html (with the server running).

- Pick or create a player, set the limits the coach must stay inside (minimum pace, act lengths, lift target and range, flower spacing, session length), add the parent's reward list, write notes for the coach.
- **Play as this player** makes that player current for the game (limits, greeting, memory, rewards).
- The session table shows every finished game with the coach's note.
- Chips at the top show which sponsor integrations are live.

## Keys and sponsor features

Create a file named `.env` in the repo root (it is gitignored; never commit keys):

```
GEMINI_API_KEY=...        # MLH Best Use of Gemini API: live coach cues, session notes, reward host
BACKBOARD_API_KEY=...     # MLH Best Use of Backboard: the coach remembers each player across sessions
MONGODB_URI=mongodb+srv://...   # MLH Best Use of MongoDB Atlas: players and sessions
PERCEPTRON_API_KEY=...    # Perceptron track: Mk1.5 double-checks stomps, dodges and form from leg-only frames
```

Perceptron also needs consent: tick "Perceptron double-check" for the player in the therapist panel and save. Without it no frame leaves the laptop.

Restart the server after editing it. Without keys everything still works on rule-based fallbacks and a local file; the Visa checkout stays a labelled mock until Visa sandbox credentials exist.

## Camera (press V in the game)

1. Connect the phone as a webcam (Mac: Continuity Camera; Windows: an app such as Camo) or plug in a webcam.
2. Press **V**, enter the player's height, click **Start**, pick the camera in the list. The first start downloads the pose model (needs internet once).
3. Place the camera in front of the player at about 45°, at knee height, both lower legs in view, good light.
4. The panel shows fps and live lift per foot. Walk in place: lift numbers should rise and fall with each step.

The camera sends the same foot events as the keyboard, so you can mix them while testing.

## Raspberry Pi or another camera computer

See [../vision/CONTRACT.md](../vision/CONTRACT.md): POST foot events to `http://<laptop-ip>:8000/api/events` (or the `/ws/events` WebSocket). `python3 vision/pi_sender.py --server http://<laptop-ip>:8000 --demo` simulates a walk. The key bar shows "bridge connected" when the game is listening.

Keyboard play (no camera needed): **A / D** normal step, **Q / E** high step (stomp a flower, dodge a seed), **W** auto-walk, **Space** pause, **Z / C** mark the walking zone (same saved corners as the check page), **K** show/hide keys, **M** coach voice on or off, **N** sound effects and music on or off (saved locally).

Useful URLs: `?demo=1` short game for judges, `?scene=play&act=garden&auto=1` jump to act 2 with auto-walk, `?scene=home` preview the end screen.

How it plays: act 1 walk home (keep at least 80 steps per minute; your normal step height is measured here), act 2 high-step onto the flowers in your foot's lane, act 3 lift the foot the seed is aiming at. Heights are relative to your own normal step, and the lift bars beside the footprints show your lift against the line you need.

Files: `logic.js` rules (tested), `game.js` Phaser scenes and art, `bus.js` foot events, `vision.js` camera step detector (tested), `camera-panel.js` the V panel, `bridge.js` events from the server, `warp.js` projector corners, `zone.js` guided zone setup, `ambient.js` garden and outside HUD, `projection.css` projector layout.

## Walk clips and local sound (CloudForce Most Viral)

Install `server/requirements.txt` before the event; it includes the pure-Python Segno QR generator. Clips, QR codes, effects and music use no CDN or downloaded runtime assets. The existing camera pose loader in `vision.js` still uses remote MediaPipe/model URLs; this feature does not change that loader. Keyboard and Pi-bridge play do not need those downloads.

Act 3 starts recording **only the Phaser game canvas**, including two seconds of the Home celebration. The ambient garden and outside HUD are not recorded. Neither the camera panel nor camera/microphone tracks are recorded. The synthesized game audio is included when its WebAudio recording tap was available at the start of act 3; speechSynthesis is not recorded. Press a key or start the game to unlock browser audio. The quiet melody and bass play during the walk, duck under coach speech, and stop on pause and arrival.

The recorder uses 15 fps, approximately 1 Mbps VP8 (VP9/WebM fallback), and at most two staggered encoders. Complete rolling windows retain about **10–20 seconds**, or less for a short act, without losing WebM headers or re-encoding. Each upload is capped at 30 MiB. Unsupported recording or a missing server shows a message on Home; the game and session saving still work. The Home preview (`?scene=home`) has no recorded clip.

To try a clip from a phone:

1. Run the server above (on the laptop, `--host 0.0.0.0`) and open `http://localhost:8000/?demo=1`.
2. Put the phone on the same Wi-Fi/hotspot, with client isolation disabled. Confirm it can open `http://<laptop-LAN-IP>:8000/`. No internet connection is required for sharing.
3. Press Enter and walk, or press W for auto-walk. Press Q/E for high steps. Finish act 3 and wait for **Scan to get your walk clip** on Home, then scan the QR. Tap the video to play and use the phone browser's save/share controls. Clicking the QR also opens the clip on the laptop.
4. The server selects its LAN IP from the routing table without sending packets. On a laptop with multiple network adapters, set `CLIP_HOST=<reachable-LAN-IP>` before starting the server if it selects the wrong interface. Keep the server running while people retrieve clips.

`POST /api/clip` accepts a raw `video/webm` or `video/mp4` body, checks its container signature and size, and returns `{id, url}`. `GET /clips/<id>` serves the video inline; `GET /api/qr?url=...` returns a local SVG. Files persist under gitignored `data/clips/<random-id>.webm` (or `.mp4`) until the operator removes them; anyone with the clip URL on the reachable network can open it. Vertical exports and generated sharing captions are not included.

Implementation: `clip.js` handles bounded recording/upload, `sound.js` handles short WebAudio envelopes and the music timer. No new npm dependencies or audio files are used.

## Projector check (works now, no server needed)

1. Download the repo (or just `web/calibrate.html` and `web/warp.js` into one folder).
2. Plug the projector into the laptop over HDMI, set the display to **extend**, drag a Chrome window onto the projector.
3. Open `calibrate.html` in Chrome on that window and press **F** for fullscreen.
4. Point the projector at a white mat or board on the floor (flip stand pointing down, or from a table or shelf).

| Key | What it shows | What to check |
|---|---|---|
| 1 | grid with a thick white border | straight lines; the border sits on the mat edges after calibration |
| 2 | colour patches | which colours stay readable in hall light (the game will use those) |
| 3 | text sizes | the smallest text you can read standing on the mat |
| 4 | full white | maximum brightness: is the mat clearly lit with the hall lights on? |
| 5 | lanes preview | flowers, a seed ball and the walking zone at real size |
| C | draggable corners | drag the four pink dots onto the mat corners; saved in the browser and reused by the game |
| R | reset corners | |
| V | camera check | pick the phone or webcam, see the measured fps (aim for 30 or more) |

Phone as the camera: on a Mac, an iPhone shows up as a camera on its own (Continuity Camera; same Apple ID, Wi-Fi and Bluetooth on). On Windows, install a webcam app such as Camo on the phone and the laptop.

Please send back: a photo of the projected grid on the mat with the hall lights on, the colours that stay readable, the smallest readable text size, and the camera fps.

## Two screens: projector and laptop

- Laptop first: open `/camera.html` on the laptop screen (O in a game window that is not fullscreen opens it too).
- Projector: open the game (`/`, add `?demo=1` for the short version, `&floor=1` for a white board) in a second window, drag it to the projector screen, then F for fullscreen.
- Keep the camera window visible: Chrome stops the camera in a hidden or fully covered window.
- The camera window owns the camera: pick the camera, set the player's height, press Start. It shows the camera picture with the leg skeleton, live lift values and a graph, every step and plant, a copy of the projected game, and every Perceptron verdict. Leave the game's own camera (V) off.
- Both windows must be in the same browser on the same laptop; they talk over a BroadcastChannel.
