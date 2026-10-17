# Hardware brief: projected walking-pad PT game

Date: 2026-10-17. Each bracketed tag points to a source with a verbatim quote at the end. "Arithmetic" marks our own calculations.

## Decisions

- **Projector:** buy a standard-throw projector (throw ratio about 1.25–1.7) with at least 3,000 lumens. Not a short-throw, and not a 300–500 lm mini. Buy the **Epson EpiqVision Flex CO-W01** today ($399.99) [P1][P2]. The **ViewSonic LS510WH-2** fits better (LED, rated for any mounting angle) [P3], but only if you find it locally at a sane price.
- **Camera:** use a webcam you already have, plugged into the laptop. 30 fps works and 720p60 is better. Buy a Logitech C922 only if your webcams cap at 30 fps [C5].
- **Pose:** run it on the laptop with MediaPipe Pose (lite or full). Leave the Pi out: it neither runs the model nor streams frames.
- **Sensors:** skip the KY-037/038. As an option, tape one piezo under the deck, read it on the ESP32 as a "foot landed" trigger, and take left/right from the camera.

## 1. Projector

**Throw (arithmetic).** Image width W = D / TR. To cover 1.2 m of belt from 1.5–2.0 m away you need TR 1.25–1.67. At D = 1.8 m:

- CO-W01: 1.05–1.42 m wide.
- LS510WH-2: 1.15–1.38 m wide.
- A short-throw (TR 0.5): 3.6 m wide, which is 9× the area and one-ninth the light on the belt.

**Brightness (arithmetic).** A 1.3 × 0.81 m image is about 1.05 m².

- 3,000 lm on it is about 2,800 lux before losses.
- 450 lm is about 430 lux, which only matches office lighting (320–500 lux) [P9], and the dark belt makes it worse.

| Model | Light | Lumens | TR | Keystone | HDMI | Weight | Price |
|---|---|---|---|---|---|---|---|
| Epson CO-W01 | lamp, 188 W | 3,000 | 1.27–1.71 | ±30° | 1 | 2.4 kg | $399.99 [P1][P2] |
| ViewSonic LS510WH-2 | LED, 360° | 3,000 ANSI | 1.3–1.56 | ±40° V | 1 | 5.8 lb | unconfirmed: the $399.99 refurb is sold out [P4]; an eBay listing asks $1,011.70 [P5] |

**Where to buy.**

- Best Buy: we could not see store stock (the page blocked us); use "Pickup today" in the app.
- Micro Center: no Washington store as of November 2025 [P10].
- Amazon: Amazon Now in Seattle sells household items [P11]; same-day delivery of a projector is not confirmed.

**Tilt.** The CO-W01 pages give no tilt rating. An Epson manual page (model not named) warns that a tilt over three degrees could damage the projector [P7]. Pointing a lamp projector steeply down is therefore undocumented. Either use the LS510WH-2 or keep the projector level and fold the beam down with a 45° mirror.

**Mount.** Use a light stand with a boom, for example the Neewer: 3 m tall, 5 kg boom load, sandbag included, $99.99 [M1]. Either projector (2.4–2.7 kg) is within that load. Glazer's Camera at 811 Republican St, Seattle sells arms, for example one rated 8 kg for $49.90 [M2]; we did not check its stock.

Setup:

1. Stand at the front corner of the pad.
2. Boom over only the front 20–30 cm of the belt.
3. Lens 1.8–2.0 m above the deck, aimed back toward the walker.
4. Fix the leftover skew with a 4-corner homography in software.

**Safety.** Epson warns against unstable stands and calls for securing the projector with wire [P8]. A weight bag is recommended for a stand with an arm [M2].

- Sandbag on the stand legs.
- A safety cord from the projector to the stand.
- The boom never over the walker's head.
- Cables taped away from the belt.

## 2. Camera

- **Frame rate.** At 25 Hz, side video gave a 0.02 s mean step-time error [C1]. At 60 Hz, strides were detected within 2–5 frames [C2]. A frame lasts 33 ms at 30 fps (arithmetic), which is enough for game feedback.
- **Pi cameras.** Camera Module 3: 66° horizontal (Wide: 102°), 1536×864 at 120 fps. Global Shutter: 1456×1088 at 60 fps [C3]. Ribbon cables come in 200/300/500 mm [C4]; we found no official maximum length.
- **Webcam.** C922: 720p at 60 fps, 78° diagonal, $119.99 [C5]. Passive USB 2.0 reaches 5 m [C6].
- **Coverage (arithmetic).** 2·d·tan(HFOV/2). At 1.5 m, a 66° lens covers 1.95 m and the C922 (about 70° horizontal) about 2.1 m, so either sees the whole belt.
- **Placement.** From the side, the near leg hides the far foot; the 25 Hz study used one camera per side [C1]. With a single camera, put it at ankle height on a front diagonal.

## 3. Pose speed: Pi vs laptop

| Platform | Model | Measured |
|---|---|---|
| Pi 4 CPU | MoveNet Lightning INT8 | 95 ms/frame (≈10 fps) [T1] |
| Pi 5 CPU | MoveNet MultiPose 256×256 | 17 fps (S) [T2] |
| reComputer R1000 + Hailo-8L | YOLOv8 pose 640×640 | 0.5 → 27 fps (S) [T3] |
| 2019 MacBook Pro 15" | BlazePose lite/full/heavy | 92/81/38 fps [T4] |

We found no end-to-end fps for a Pi 5 with the AI HAT+. With no extra hardware, the laptop runs about 5–9× the Pi CPU numbers. This is a rough comparison, since the models differ.

## 4. Footstep sensing

- **KY-037/038.** An LM393 comparator board, "ideally suited for threshold value measurement" [S1]. No source shows it picking out heel strikes over motor noise. Skip it.
- **Piezo.** Wire 1 MΩ in parallel and read it with `analogRead()` [S2]; $0.95 each [S3].
- **Left/right.** Floor geophones reached 90.5% accuracy on timing (RMSE 0.08 s), but the study labelled left and right by alternation, not by sensor position [S4]. We found no treadmill study that separates the feet with two deck sensors. Do not rely on two piezos on one stiff deck to tell left from right.
- **ADC.** The ESP32 samples at 20 kHz–2 MHz, 12-bit [S5]. Use ADC1 pins, because ADC2 is shared with Wi-Fi [S6]. The Pi has no analog inputs [S1] and would need an MCP3008 (200 ksps) [S7].

## 5. Shopping list

| Item | Why | Model / spec | Price | Where | Priority |
|---|---|---|---|---|---|
| Projector | game image | Epson CO-W01 | $399.99 | Best Buy (stock unverified) | must |
| Stand + boom + sandbag | mount | Neewer 3 m, 5 kg | $99.99 | Neewer/Amazon or Glazer's | must |
| Mount adapter, safety cord, gaffer tape | attach, secure | tray or universal mount, 1/4"-20 | not checked | Glazer's / Best Buy | must |
| 15 ft HDMI + USB-C→HDMI | laptop → projector | — | not checked | Best Buy | must |
| 720p60 webcam | finer timing | Logitech C922 | $119.99 | Best Buy / Logitech | nice |
| 2 piezos + 1 MΩ | step trigger | enclosed piezo | $1.90 | hardware table / Adafruit | nice |

**Total:** $499.98 for the must-haves with confirmed prices, plus the unchecked items. With the nice-to-haves: $621.87.

## Sources

(S) = secondary.

- P1 "Lamp", "188W UHE", "1.27-1.71", "-30 to +30 degrees", "1 x HDMI", "2.4 kg" https://www.epson.co.nz/products/projector/CO-W01_Specs.asp
- P2 "$399.99" https://epson.com/p/V11HA86020
- P3 "3,000 ANSI", "1.3-1.56", "(+/- 40°)", "360 degree projection", "Net (lbs): 5.8" https://www.viewsonic.com/business/ls510wh-2.html
- P4 (S) "$399.99", "Sold Out" https://sellout.woot.com/offers/viewsonic-ls510wh-2-led-projector-4
- P5 (S) "$1,011.70" https://www.ebay.com/p/9059401221
- P7 "tilted at an angle of more than three degrees, it could be damaged" https://files.support.epson.com/docid/cpd6/cpd64535/source/setup/reference/projector_setup_install.html
- P8 "Do not place the projector on an unstable cart, stand, or table"; "secure the projector and the mounts using wire" https://files.support.epson.com/docid/cpd6/cpd62244/source/notices/reference/important_safety_instructions.html
- P9 (S) "320–500" "Office lighting" https://en.wikipedia.org/wiki/Lux
- P10 (S) "as of November 2025, has 30 stores in 20 US states" https://en.wikipedia.org/wiki/Micro_Center
- P11 (S) "in parts of Seattle"; "milk, eggs, fresh produce" https://www.fox13seattle.com/news/amazon-deliveries-30-minutes-seattle
- M1 "9.8'/3m", "11lb/5kg", "1KG counterweight and sandbag", "$99.99" https://neewer.com/collections/light-stands/products/neewer-heavy-duty-light-stand-with-sandbag-66601134
- M2 "$49.90", "(8 kg)", "we recommend using a weight bag", "811 Republican St." https://www.glazerscamera.com/products/westcott-shorty-extension-arm
- C1 "was 25 Hz"; "0.02 s for temporal gait parameters"; "left (camera CL) and right (camera CR) side sagittal plane views" https://pmc.ncbi.nlm.nih.gov/articles/PMC8099131/
- C2 "recorded at 60 Hz"; "accurate within two to five frames" https://pmc.ncbi.nlm.nih.gov/articles/PMC10220686/
- C3 "66 degrees | 102 degrees", "1536 × 864p120", "1456 × 1088p60" https://www.raspberrypi.com/documentation/accessories/camera.html
- C4 "200mm, 300mm, and 500mm" https://www.raspberrypi.com/products/camera-cable/
- C5 "720p at 60fps", "78° diagonal", "$119.99" https://www.logitech.com/en-us/products/webcams/c922-pro-stream-webcam.960-001087.html
- C6 (S) "USB 2.0: Maximum length of 5 meters" https://knowledge.cambrionix.com/Content/Articles/USB/Maximum-Length-of-a-USB-Cable.htm
- T1 "MoveNet.Lightning (INT8 quantized) ... 95ms" (Raspberry Pi 4 column) https://blog.tensorflow.org/2021/08/pose-estimation-and-classification-on-edge-devices-with-MoveNet-and-TensorFlow-Lite.html
- T2 (S) "movenet_multipose"; "At 256x256, it goes at 17fps on the rasp 5." https://hackaday.io/project/162944/log/228804
- T3 (S) "only 0.5 FPS, whereas after acceleration, it reached 27 FPS" https://wiki.seeedstudio.com/yolov8_pose_estimation_on_recomputer_r1000_with_hailo_8l/
- T4 MacBook Pro 15" 2019, MediaPipe runtime: "92 | 81 | 38" https://blog.tensorflow.org/2021/05/high-fidelity-pose-tracking-with-mediapipe-blazepose-and-tfjs.html
- S1 "LM393 comparator"; "ideally suited for threshold value measurement"; "no analog inputs" https://sensorkit.joy-it.net/en/sensors/ky-038
- S2 "1-megohm resistor in parallel to the Piezo element" https://raw.githubusercontent.com/arduino/docs-content/main/content/built-in-examples/06.sensors/Knock/Knock.md
- S3 "$0.95" https://www.adafruit.com/product/1740
- S4 "90.5% (RMSE 0.08s)"; "two adjacent footsteps are marked from the left and right foot, respectively" https://par.nsf.gov/servlets/purl/10528803
- S5 "(2*1000*1000)", "(20*1000)", "MAX_BITWIDTH (12)" https://raw.githubusercontent.com/espressif/esp-idf/release/v5.3/components/soc/esp32/include/soc/soc_caps.h
- S6 "ADC2 is also used by Wi-Fi." https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/adc/adc_continuous.html
- S7 "200 ksps max. sampling rate at VDD = 5V" https://ww1.microchip.com/downloads/en/DeviceDoc/21295d.pdf
