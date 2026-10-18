# web

## Play the game

With the server (needed for the Raspberry Pi bridge; the AI coach and saving come next):

```bash
python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt     # once, from the repo root
.venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000
# open http://localhost:8000 in Chrome on the projector window, press F
```

Without the server (keyboard and camera still work): `cd web && python3 -m http.server 8000`.

## Camera (press V in the game)

1. Connect the phone as a webcam (Mac: Continuity Camera; Windows: an app such as Camo) or plug in a webcam.
2. Press **V**, enter the player's height, click **Start**, pick the camera in the list. The first start downloads the pose model (needs internet once).
3. Place the camera in front of the player at about 45°, at knee height, both lower legs in view, good light.
4. The panel shows fps and live lift per foot. Walk in place: lift numbers should rise and fall with each step.

The camera sends the same foot events as the keyboard, so you can mix them while testing.

## Raspberry Pi or another camera computer

See [../vision/CONTRACT.md](../vision/CONTRACT.md): POST foot events to `http://<laptop-ip>:8000/api/events` (or the `/ws/events` WebSocket). `python3 vision/pi_sender.py --server http://<laptop-ip>:8000 --demo` simulates a walk. The key bar shows "bridge connected" when the game is listening.

Keyboard play (no camera needed): **A / D** normal step, **Q / E** high step (stomp a flower, dodge a seed), **W** auto-walk, **Space** pause, **C** drag the corners onto the mat (same calibration as the check page), **M** voice on or off.

Useful URLs: `?demo=1` short game for judges, `?scene=play&act=garden&auto=1` jump to act 2 with auto-walk, `?scene=home` preview the end screen.

How it plays: act 1 walk home (keep at least 80 steps per minute; your normal step height is measured here), act 2 high-step onto the flowers in your foot's lane, act 3 lift the foot the seed is aiming at. Heights are relative to your own normal step, and the lift bars beside the footprints show your lift against the line you need.

Files: `logic.js` rules (tested), `game.js` Phaser scenes and art, `bus.js` foot events, `vision.js` camera step detector (tested), `camera-panel.js` the V panel, `bridge.js` events from the server, `warp.js` projector corners.

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
