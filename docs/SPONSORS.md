# Sponsor tracks

Sources: the Devpost prize list, the dh26.dubhacks.co site and the sponsor home pages, read on Sat Oct 17. The Hacker Guide (sponsor briefs, judging details) is not public: it sits behind Cloudflare on Devpost and in the participants' email and Discord.

## Prizes on Devpost

| Track | Prize | What the sponsor does |
|---|---|---|
| Title: Chef's Kitchen (site: Chef's Choice), Community Kitchen, Cook Smarter | 1st and 2nd per track, prize menu per member | DubHacks |
| Visa: Reimagine Shopping | 5,000 USD | payments; brief: generative AI across discovery, decision, personalisation, checkout, payments, loyalty and rewards, post-purchase |
| SideShift 1st / 2nd / 3rd | 1,500 USD + work trial / 500 USD + interview / interview | creator marketing: brands find TikTok, Instagram and YouTube creators for UGC (sideshift.app) |
| DubHacks Next 1st / 2nd | 200 USD + guaranteed incubator interview / interview | DubHacks' startup incubator |
| CloudForce: Most Viral / Most Interesting / Raffle | 1,000 / 500 / 500 USD | nebulaONE: governed AI gateway for higher education, government and healthcare |
| Best Freshman Beginner Project | Echo Pop | DubHacks |
| SpaceXAI raffle | water bottle | x.ai |
| MLH: Gemini API, Solana, Tiger Data, Backboard, Vultr, Commit Fellowship, DEV writing, MongoDB Atlas, GoDaddy domain | swag and hardware | MLH partners |

Silver and bronze sponsors without a listed prize: Perceptron (promptable vision model), Photon (agents in iMessage, WhatsApp, Telegram), Expedia, Amazon, Salesforce, Treasury, SAP, Indomie, Veyzl; gold includes T-Mobile. Some may still have a track in the Hacker Guide.

Rules: exactly one title track, up to three sponsored side tracks, any number of non-sponsored side tracks; tracks are declared in the Devpost draft due Sat 22:30. Which prizes count as "sponsored" (for example MLH) is defined in the Hacker Guide.

## Declared tracks (Sat Oct 17, evening)

- **Title:** Community Kitchen (healthcare, accessibility, community support).
- **Sponsored 1, Perceptron:** Perceptron Mk1.5 is the game's second pair of eyes. The browser detector decides every step in real time; after a flower or seed resolves, up to eight timestamped frames of the lower legs (cropped at the knees, no face, 320 x 240 JPEG) go to `perceptron-mk1.5` with a strict JSON schema: did the named foot really stomp the flower or lift over the seed? Every 10 s a second schema checks form (on the pad, holding the rail, steady). The agreement rate goes into the HUD, the home card and the therapist panel. Frames are sent only when the therapist panel has Perceptron consent on for that player and the server has `PERCEPTRON_API_KEY`. Code: `server/perceive.py`, `web/perceive.js`.
- **Sponsored 2, SideShift:** every session ends with a ready-to-post clip of the game canvas and a QR code, so families and clinics become creators of short walking-game videos. No camera video of the child is ever in the clip.
- **Sponsored 3, CloudForce Most Viral:** the same clip is the viral loop: a kid stomping projected zombie flowers is made to be shared. VEYZL is the fallback if the CloudForce brief does not fit.
- **MLH:** Gemini API (coach cues, notes, reward host), Backboard (coach memory across sessions), MongoDB Atlas (players and sessions). Declare only those whose keys are live in the demo.
- **Not declared:** Visa. The parent reward checkout stays in the game as a labelled mock.

## To do at the venue

1. Put `PERCEPTRON_API_KEY` in the laptop's `.env` and switch Perceptron consent on for the demo player in the therapist panel.
2. Read the CloudForce brief; switch track 3 to VEYZL if it does not fit.
3. Visit the Perceptron, SideShift and CloudForce tables and ask what they score.
