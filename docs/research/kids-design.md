# Kids Movement Game: Prior Art, Safety, Design

Date: 2026-10-17

Quotes are verbatim from source [n]; (S) = secondary; **Design** = team default, unsourced. Devpost read via r.jina.ai.

## 1. Prior art

| Product | What it does | Price |
|---|---|---|
| (1) EyeClick BEAM Mobile (floor/wall projection) | "portable cart that brings interactive play to any classroom, gym, or therapy room"; games "for coordination, balance, and physical activity" [1] | "systems start at $5,796" [2] |
| (2) Lü playground (wall, schools) | "projection, motion sensors, lights, and sound"; "not suitable for smaller spaces such as homes" [3] | "Pricing depends on your setup" [3] |
| (3) Tovertafel (table projection) | "serious games system for intellectual disability care"; "children with special needs to play together" [4] | "$10,200.00" (reseller, S) [4] |
| (4) MIRA paediatric exergames | "exercising through gaming"; tracks "how effectively they are doing them" [5] | not stated |
| (5) Xbox One Kinect home training, CP | 35 children, "7-16 years"; "6-8 weeks home-based"; balance gains only "with low baseline balance performance" [6] | research |
| (6) ARWell (Augment Therapy) | "exercise games that support strength, coordination, balance, focus, and wellness"; "Kids" [7] | "$9.99 USD monthly", "$99.99 USD yearly" [7] |
| (7) EndeavorRx (ADHD game) | "children ages 8-12"; "restricted to prescription use"; FDA De Novo 06/15/2020 [8][9] | not stated |
| (8) C-Mill (clinic treadmill) | "treadmill belt projections"; "handrails, E-stops, and safety harness" [10]; children's trial "Age 6 -17 years", 10 sessions of 45 minutes [11] | not stated |
| (9) S-tardus-T (Devpost) | kids steer a spaceship by body movement via "webcam"; "generates a report for therapists" [12] | prototype |
| (10) AbilityPlay (Devpost) | camera game for CP; "adapts difficulty" and "provides progress insights for parents and physiotherapists" [13] | prototype |
| (11) Absorbit (Devpost) | "thermal camera and high powered projector suspended above a steel floor" [14] | prototype |

**Gap.** Camera tracking, adaptive difficulty and reports exist (rows 9–10); floor projection is institutional (rows 1–3); projected step targets exist only on a clinic treadmill (row 8). None puts step-and-obstacle targets on a home floor under clinician-set limits.

## 2. Treadmills and children

- **Peloton Tread+ recall** (announced May 5, 2021 [16]): "About 125,000" units; "A 6-year-old child recently died after being pulled under the rear of the treadmill"; "72 reports" of people, pets or objects pulled under, "including 29 reports of injuries to children" [15]. By 2023: "351 incident reports of pull-unders, including 90 reports of injuries" [16]. CPSC: "Stop using the Peloton Tread+ if there are small children or pets at home" [15].
- **All treadmills** (CPSC via NBC, S), 2019: "an estimated 22,500 treadmill-related injuries", "2,000 of which were to children under age 8"; "Between 2018 and 2020, 17 fatalities" [17].
- **Burns:** at one paediatric burn centre "treadmill hand burns accounted for 4% of our total burn population", care "51 days versus 11 days" (treadmill vs contact burns); advice: "baby gates or play pens" [18].
- **Walking pads:** a KingSmith WalkingPad manual allows "children aged from 8 years and above" only with supervision: "Children shall not play with the appliance"; "Contact with the moving surface may result in severe friction burns" [19]. Another KingSmith manual: "Keep children under the age of 13 away from this machine"; applicable age "14 ~ 60 years old" [20]. Most under-desk treadmills lack handrails, making it "easy to accidentally step-off, lose balance, or even fall" (S) [21]. On April 16, 2026 CPSC told owners to stop using Sperax walking pads: "201 reports of uncontrollable speed, abrupt stops", "at least 66 falls or injuries" [22].
- **Meaning:** a game is play, which the manual forbids for children, and a walking pad lacks the clinical treadmill's handrails, E-stops and harness [10]. **Design:** no walking pad in child sessions; unplugged, key removed, when children are present.

## 3. Designing for children

**Session length.** No peer-reviewed "minutes per year of age" rule found; measured doses:
- Parent-run home programmes for CP: effective at "17.5 times per month for an average of 16.5 minutes per session" [23].
- EndeavorRx: "approximately 25 minutes per day for 5 days per week", with "lock-out after the allocated gameplay" [9].
- VR gait training in CP: "20–30 min per session, ≤4 times per week across ≥8 weeks" [24].
- Home exergame trial: "30 minutes of activity, five times per week" prescribed, "136 minutes per week" played [25].
- WHO, ages 2–4: "sedentary screen time should be no more than 1 hour" [26].
- **Design:** default near the 16.5-minute dose, hard lock-out; the clinician may raise it.

**Feedback and rewards.** Children given reduced feedback retained less than those given "100% feedback" and need "feedback reduced more gradually" [27]: feedback on every step, faded slowly. "choice, reward, and goals, lead to increased motivation and engagement" [28]. For CP: "Reduce consequences of errors", "Make the game state visible", "Balance for effort" [25].

**Parents.** Effective programmes were "developed with a collaborative, evidence-based approach and implemented by parents at home" [23]. Parent reports already exist (row 10): table stakes.

**Motor impairments.** Action exergames worked "for children with CP at level III" of GMFCS [25], but the Kinect and C-Mill trials enrolled only GMFCS I–II [6][11]. Basic guidelines: "adjust the game speed", "adjust the sensitivity of controls", "Offer a wide choice of difficulty levels" [29]. **Design:** a seated hand-reach mode for children who cannot step independently.

## 4. Regulation and wording

**FDA general wellness guidance** ("issued on January 6, 2026") [30]:

| Wellness (named) | Device |
|---|---|
| "develop or improve endurance, strength or coordination" | "restore a structure or function impaired due to a disease or condition" |
| "improve general mobility or to assist individuals who are mobility impaired in a recreational activity" | "a computer game will diagnose or treat autism" |
| "improve mental acuity, instruction following, concentration" (questions while moving) | "references to specific diseases, clinical conditions, or diagnostic thresholds" |

*Balance* is not named; call it coordination or fitness. A worked example warns that implying "use in a medical or clinical context" leaves wellness [30]: the clinician report's risk. EndeavorRx is the other path: disease claim, De Novo, prescription [8][9]. **Design:** say *builds coordination, strength and endurance*; never *rehab after injury*, *treats CP* or *detects decline*.

**COPPA:** "Child means an individual under the age of 13"; personal information includes "A photograph, video, or audio file where such file contains a child's image or voice" and biometric identifiers such as "gait patterns; facial templates" [31]. Operators "must obtain verifiable parental consent before collecting any personal information from a child" and retain it "only as long as is necessary" [32]. Amended "April 22, 2025" [32], with "one year" to comply [33]. **Design:** on-device pose estimation, no video upload, scores only, parental consent before the first camera session.

## 5. Recommendation

Yes: for children the core is a floor-projection game on a stable floor, no treadmill ("Children shall not play with the appliance" [19]). The walking pad is an optional, supervised teen/adult mode within the model's stated age ("14 ~ 60 years old" in one manual [20]), targets on screen, not on the belt (**Design**).

Differences from prior art:
1. **Step targets on a home floor.** Floor projection starts at $5,796 [2], costs $10,200 [4] or is not for homes [3]; webcam apps use a screen [7][12][13]. A home projector and phone camera put the target where the foot lands: step placement and foot clearance are the game.
2. **Therapist rules as hard limits.** AbilityPlay adapts on its own [13]; this coach adapts only inside clinician-set limits: session lock-out [9], slowly faded feedback [27], stop rules.
3. **Safe and private by default.** Age-gated treadmill tier, wellness-only claims [30], on-device video so no child image or gait data leaves home [31].

## Sources

1. https://exceptionalchildren.org/partner-resources/products/eyeclick
2. https://eyeclick.com/pricing
3. https://play-lu.com/faq/
4. https://stemfinity.com/products/tovertafel-interactive-projector-system
5. https://www.imperial.ac.uk/engagement-and-simulation-science/our-work/past-projects/mira/
6. Meyns 2022: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:34365883&resultType=core
7. https://apps.apple.com/app/id6464760244
8. https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/denovo.cfm?id=DEN200026
9. https://www.accessdata.fda.gov/cdrh_docs/reviews/DEN200026.pdf
10. https://www.motekmedical.com/product/c-mill/
11. https://www.onderzoekmetmensen.nl/en/node/46543
12. https://devpost.com/software/s-tardus-t
13. https://devpost.com/software/abilityplay-play-without-limits
14. https://devpost.com/software/absorbit-game
15. https://www.cpsc.gov/Recalls/2021/Peloton-Recalls-Tread-Plus-Treadmills-After-One-Child-Died-and-More-than-70-Incidents-Reported
16. https://www.cpsc.gov/Newsroom/News-Releases/2023/Peloton-Tread-Rear-Guard-Repair-Approved-Protects-Consumers-from-Entrapment-Hazards-One-Child-Death-and-90-Injuries-Reported
17. https://www.nbcnews.com/news/amp/ncna1261429 (S)
18. https://www.nationwidechildrens.org/newsroom/news-releases/2016/10/new-study-finds-exercise-treadmills-significant-cause-of-hand-burns-in-children
19. TRR2F manual: https://dwn.alza.cz/manual/99690
20. TRK12F manual: https://justmore.dk/images/media/ProductsDocs/Walkingpad%20TRK12F%20-%20vn998932481.pdf
21. https://www.consumerreports.org/health/treadmills/are-under-desk-treadmills-safe-a4593016844/ (S)
22. https://cpsc.gov/Warnings/2026/CPSC-Warns-Consumers-to-Stop-Using-Sperax-Walking-Pads-and-Treadmills-Immediately-Due-to-Risk-of-Serious-Injury-from-Fall-Burn-and-Fire-Hazards
23. Novak 2009: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:19770175&resultType=core
24. Ghai 2019: https://pmc.ncbi.nlm.nih.gov/articles/PMC6448032/
25. Hernandez 2013: https://research.cs.queensu.ca/home/hamilton/files/CHI13-Designing-action-based-exergames-for-children-with-cp.pdf
26. https://www.who.int/news/item/24-04-2019-to-grow-up-healthy-children-need-to-sit-less-and-play-more
27. Sullivan 2008: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:18339797&resultType=core
28. Lohse 2013: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:24232363&resultType=core
29. https://gameaccessibilityguidelines.com/basic/
30. https://www.fda.gov/media/90652/download
31. 16 CFR 312.2: https://www.ecfr.gov/api/versioner/v1/full/2026-09-01/title-16.xml?part=312&section=312.2
32. https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
33. https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
