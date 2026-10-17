# Stride Defense: evidence brief

2026-10-17 · DubHacks '26, Community Kitchen track

Every number cites a page opened on 2026-10-17; sources are primary unless marked *secondary*. PubMed was read through NCBI E-utilities and Devpost through r.jina.ai.

## 1. Problem

**Falls in older adults (US, 65+)**
- Over 14 million older adults, 1 in 4, report falling every year [1].
- Falls caused over 43,000 deaths in 2024, the leading cause of injury death at this age, and about 4.5 million emergency visits [2]; about 1.4 million of those visits a year end in hospitalization [3].
- The age-adjusted fall death rate rose 21%, from 64.7 to 78.4 per 100,000, between 2018 and 2024 [1].
- Healthcare spending on nonfatal falls was US$80.0 billion in 2020, most of it paid by Medicare [4]. In 2015, fatal and nonfatal combined: about US$50.0 billion [5].
- About 53% of falls in healthy older adults are estimated to come from tripping while walking [6] (*secondary*, citing Blake 1988).

**Lower-limb injury:** nearly 319,000 older people are hospitalized for hip fractures each year [3].

**Access gap to physical therapy**
- Cost: under Medicare the patient pays 20% of the approved amount after the Part B deductible [7], which is US$283 in 2026 [8]. In 2008-2012 a PT episode averaged 9.9 visits and US$1,708 in total; patients with out-of-pocket costs paid a mean of US$351 [9].
- Waiting: the vacancy rate for outpatient therapists was 17% in 2022, and patients report "waiting weeks or even months" [10] (*secondary*, citing APTA).
- Rural: one PT per 2,720 people in isolated rural areas against one per 1,216 in metropolitan areas (Minnesota data); 61.2% of rural hospital CEOs report needing PTs [11] (*secondary*).
- Home programs go undone: across 23 RCTs only 21% (95% CI 15-29%) of participants did the full prescribed dose [12].

## 2. Why this solution

1. **Treadmill walking with obstacles cuts falls.** V-TIME (The Lancet 2016): 302 high-risk adults aged 60-90, five countries, 6 weeks. Adding an obstacle scene on a large screen gave a falls incident rate ratio of 0.58 (95% CI 0.36-0.96) against treadmill alone, or 42% fewer falls [13].
2. **Stepping onto targets works.** Step-training meta-analysis, 7 RCTs, n=660: falls rate ratio 0.48 (0.36-0.65). Volitional (target) stepping worked as well as reactive [14].
3. **A home step game can work (2022-2026).** smart±step RCT (Nature Medicine 2024, n=769, age 65+): step exergame on a mat at home, falls IRR 0.74 (0.56-0.98) against control [15]. A meta-analysis of exergame rehabilitation found 0.91 fewer falls per person per year (4 RCTs, 316 people, moderate quality) [16].
4. **Unsupervised games fail when fit and dose slip, so the coach matters.** A home step game in Parkinson's disease (n=60) was not effective, and Timed Up and Go favoured control [17]. In multiple sclerosis (n=461) a home step exergame did not reduce falls (IRR 0.96); participants trained a mean of 70 of the prescribed 120 minutes a week [18].
5. **Games and family keep people training.** Median adherence: 91.25% for technology-based vs 83.58% for traditional exercise [19]. In the BE FIT family game, step goals were met on 0.53 vs 0.32 of participant-days (200 adults, mean age 55.4) [20]. Financial incentives added 607 steps a day (95% CI 422-792); modest incentives of about US$1.40 a day were enough (mean age 41) [21].
6. **AI-guided home PT can match in-person care.** Sword Health's own RCT (chronic low back pain): equal disability gains, dropout 15.7% digital vs 34.3% in-person [22]. A 2026 meta-analysis of AI-based PT for low back pain: significant but clinically small effects, low certainty [23].

**Caveat for the pitch:** belt projection is not proven better: in 70 hip-fracture patients, a projected-belt treadmill, a plain treadmill and usual PT gave similar results [24]; V-TIME used a screen. Say "training game modelled on published trials", never "prevents falls".

## 3. Prior art

| Name | Type | What it does | Cost | Src |
|---|---|---|---|---|
| C-Mill (Motek) | Clinical | Treadmill with obstacles and targets projected on the belt, plus VR; force plate measures gait | No public price | [25] |
| V-TIME set-up | Research | Treadmill, motion-capture camera and an obstacle scene on a large screen | VR add-on about US$4,500 on top of a treadmill (*secondary*, press release) | [13][26] |
| Dividat Senso | Clinical | Cognitive-motor training device whose games adapt to the user's level; lists rehabilitation after falls | No price in brochure | [27] |
| SilverFit Mile, 3D | Care homes | Virtual cycling; gross-motor and daily-living games | "Request price"; buy, rent or lease | [28] |
| smart±step | Research, home | Step exergame on a mat | Not stated | [15] |
| Projected cues on treadmill | Research | Visual cues on the treadmill in Parkinson's (n=23), with better Timed Up and Go than treadmill alone | n/a | [29] |
| Interactive Walkway | Research | 10 m walkway tracked by Kinect, augmented with stepping targets and obstacles | n/a | [30] |
| Sword Health (owns Kaia since Jan 2026) | Digital PT | AI plus physical therapists, home musculoskeletal programs | 50/50 outcome pricing, US$799 average cap per user (*secondary*, benefits administrator) | [31][32] |
| Hinge Health | Digital PT | Camera tracks 100+ body points for exercise feedback; gait not mentioned | Per-member platform fee plus a per-session fee; no public amount | [33][34] |
| Kaia Motion Coach | Digital PT | Phone camera tracks body landmarks for exercise form; gait not mentioned | No price on page | [35] |
| Dreadmill | Hackathon (winner, Renaissance Hack) | Oculus Rift zombie game on a treadmill; an Arduino replaced the treadmill board | Prototype | [36] |
| World Tour Z | Hackathon (third prize overall) | Zombie-clown game driven by pedalling; running mode on a treadmill | Prototype | [37] |
| Guiding Hands | Hackathon | Game projected onto a board; camera checks post-stroke hand exercises | Prototype | [38] |
| StepSure; Lets Walk; GaitGuard | Hackathon | Gait analysis from phone video; MediaPipe physio game with an AI voice coach; wearable gait feedback | Prototype | [39][40][41] |

**Our difference**
- **Walking under challenge at home.** A lane game projected onto a consumer walking pad: obstacles to lift over, targets to step on, questions to answer aloud. The C-Mill and V-TIME training form without a clinic system; the PT apps coach exercises, not walking.
- **A coach that measures and adapts.** A side camera measures steps and foot lift each session; the AI coach sets the next wave and logs the dose, the piece missing where unsupervised home games failed.
- **A family league with real rewards.** Verified sessions unlock rewards paid through Visa; social and cash incentives both have RCT support. No row above combines all three.

## 4. Pitch

**30 seconds:** Every year over 14 million older Americans fall, and nonfatal falls cost US$80 billion in 2020. The training that works is known: in The Lancet, walking a treadmill while stepping over virtual obstacles led to 42% fewer falls than the treadmill alone. But it lives in clinics, and at home only 21% complete the full program. Stride Defense projects a lane game onto a walking pad. An AI therapist watches every step and adapts the game, and a family league turns finished sessions into real rewards through Visa.

**Five numbers for the slide**
1. **14 million+** US older adults fall each year [1]
2. **US$80.0 billion** spent on nonfatal falls in 2020 [4]
3. **42% fewer falls**: treadmill plus obstacle VR against treadmill alone (IRR 0.58) [13]
4. **21%** of home fall-prevention participants did the full dose [12]
5. **53% vs 32%** of days meeting step goals with a family game [20]

## Sources

1. https://www.cdc.gov/falls/data-research/index.html
2. https://www.cdc.gov/falls/about/index.html
3. https://www.cdc.gov/falls/data-research/facts-stats/index.html
4. https://pubmed.ncbi.nlm.nih.gov/39029927/
5. https://pubmed.ncbi.nlm.nih.gov/29512120/
6. https://pmc.ncbi.nlm.nih.gov/articles/PMC5375113/
7. https://www.medicare.gov/coverage/physical-therapy-services
8. https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles
9. https://pubmed.ncbi.nlm.nih.gov/26112257/
10. https://kffhealthnews.org/republish/aging/physical-therapist-pt-shortage-training-programs/
11. https://rrh.org.au/journal/article/6614/
12. https://pubmed.ncbi.nlm.nih.gov/22813920/
13. https://pubmed.ncbi.nlm.nih.gov/27524393/
14. https://pubmed.ncbi.nlm.nih.gov/26746905/
15. https://pubmed.ncbi.nlm.nih.gov/38228913/
16. https://pubmed.ncbi.nlm.nih.gov/36580901/
17. https://pubmed.ncbi.nlm.nih.gov/28745063/
18. https://pubmed.ncbi.nlm.nih.gov/38362861/
19. https://pubmed.ncbi.nlm.nih.gov/27362526/
20. https://pubmed.ncbi.nlm.nih.gov/28973115/
21. https://pubmed.ncbi.nlm.nih.gov/31092399/
22. https://pubmed.ncbi.nlm.nih.gov/37420107/
23. https://pubmed.ncbi.nlm.nih.gov/42452382/
24. https://pubmed.ncbi.nlm.nih.gov/28031021/
25. https://www.motekmedical.com/product/c-mill/
26. https://neurosciencenews.com/movement-falls-parkinsons-5410/
27. https://www.bfu.ch/media/g2bd3wtx/dividat_senso_ueberblick_aussteller_en.pdf
28. https://www.silverfit.com/en/
29. https://pubmed.ncbi.nlm.nih.gov/26038610/
30. https://pubmed.ncbi.nlm.nih.gov/28340371/
31. https://demo.askallegiance.com/Documents/Vendor_Spotlight/March%202026_Allegiance%20Vendor%20Spotlight_Sword%20Health.pdf
32. https://kaiahealth.com/newsroom/press-releases/kaia-health-joins-sword-health/
33. https://www.hingehealth.com/computer-vision
34. https://www.sec.gov/Archives/edgar/data/1673743/000162828026013808/hnge-20251231.htm
35. https://kaiahealth.com/motion-coach/
36. https://devpost.com/software/dreadmill
37. https://devpost.com/software/world-tour-z
38. https://devpost.com/software/guiding-hands
39. https://devpost.com/software/stepsure
40. https://devpost.com/software/lets-walk-application
41. https://devpost.com/software/gaitguard
