# Игра на движение для детей: аналоги, безопасность, дизайн

Дата: 2026-10-17

Цитаты рядом с [n] дословно взяты из источника n и оставлены на английском; (S) = вторичный источник; **Дизайн** = решение команды по умолчанию, не из источника. Страницы Devpost прочитаны через r.jina.ai.

## 1. Аналоги

| Продукт | Что делает | Цена |
|---|---|---|
| (1) EyeClick BEAM Mobile (проекция на пол/стену) | "portable cart that brings interactive play to any classroom, gym, or therapy room"; игры "for coordination, balance, and physical activity" [1] | "systems start at $5,796" [2] |
| (2) Lü (интерактивная площадка на стене, школы) | "projection, motion sensors, lights, and sound"; "not suitable for smaller spaces such as homes" [3] | "Pricing depends on your setup" [3] |
| (3) Tovertafel (проекция на стол) | "serious games system for intellectual disability care"; "children with special needs to play together" [4] | "$10,200.00" (реселлер, S) [4] |
| (4) MIRA, детские экзерсайз-игры | "exercising through gaming"; отслеживает "how effectively they are doing them" [5] | не указана |
| (5) Домашние тренировки на Xbox One Kinect, ДЦП | 35 детей, "7-16 years"; "6-8 weeks home-based"; равновесие улучшилось только у детей "with low baseline balance performance" [6] | исследование |
| (6) ARWell (Augment Therapy) | "exercise games that support strength, coordination, balance, focus, and wellness"; "Kids" [7] | "$9.99 USD monthly", "$99.99 USD yearly" [7] |
| (7) EndeavorRx (игра при СДВГ) | "children ages 8-12"; "restricted to prescription use"; FDA De Novo 06/15/2020 [8][9] | не указана |
| (8) C-Mill (клиническая беговая дорожка) | "treadmill belt projections"; "handrails, E-stops, and safety harness" [10]; детское исследование: "Age 6 -17 years", 10 занятий по 45 минут [11] | не указана |
| (9) S-tardus-T (Devpost) | дети управляют космическим кораблём движениями тела через "webcam"; "generates a report for therapists" [12] | прототип |
| (10) AbilityPlay (Devpost) | игра с камерой для детей с ДЦП; "adapts difficulty" и "provides progress insights for parents and physiotherapists" [13] | прототип |
| (11) Absorbit (Devpost) | "thermal camera and high powered projector suspended above a steel floor" [14] | прототип |

**Пробел.** Трекинг камерой, адаптивная сложность и отчёты уже есть (строки 9–10); проекция на пол существует только в масштабе учреждений (строки 1–3); проецируемые цели для шага есть только на клинической дорожке (строка 8). Ни один аналог не ставит цели для шага и перешагивания препятствий на пол дома в рамках, заданных клиницистом.

## 2. Беговые дорожки и дети

- **Отзыв Peloton Tread+** (объявлен May 5, 2021 [16]): "About 125,000" штук; "A 6-year-old child recently died after being pulled under the rear of the treadmill"; "72 reports" о людях, животных или предметах, затянутых под дорожку, "including 29 reports of injuries to children" [15]. К 2023: "351 incident reports of pull-unders, including 90 reports of injuries" [16]. CPSC: "Stop using the Peloton Tread+ if there are small children or pets at home" [15].
- **Все беговые дорожки** (CPSC через NBC, S), 2019: "an estimated 22,500 treadmill-related injuries", "2,000 of which were to children under age 8"; "Between 2018 and 2020, 17 fatalities" [17].
- **Ожоги:** в одном детском ожоговом центре "treadmill hand burns accounted for 4% of our total burn population", лечение "51 days versus 11 days" (дорожка против контактных ожогов); совет: "baby gates or play pens" [18].
- **Walking pad:** инструкция KingSmith WalkingPad допускает "children aged from 8 years and above" только под присмотром: "Children shall not play with the appliance"; "Contact with the moving surface may result in severe friction burns" [19]. Другая инструкция KingSmith: "Keep children under the age of 13 away from this machine"; допустимый возраст "14 ~ 60 years old" [20]. У большинства подстольных дорожек нет поручней, поэтому "easy to accidentally step-off, lose balance, or even fall" (S) [21]. April 16, 2026 CPSC призвала прекратить пользоваться walking pad Sperax: "201 reports of uncontrollable speed, abrupt stops", "at least 66 falls or injuries" [22].
- **Вывод:** игра есть игра, а инструкция запрещает детям играть с тренажёром; к тому же у walking pad нет поручней, аварийной остановки и страховочной обвязки клинической дорожки [10]. **Дизайн:** никакого walking pad на детских занятиях; когда рядом дети, дорожка выключена из сети, ключ вынут.

## 3. Дизайн для детей

**Длительность занятия.** Рецензируемого правила «столько-то минут на год возраста» не нашлось; есть измеренные дозы:
- Домашние программы для детей с ДЦП, которые проводят родители: эффективны при "17.5 times per month for an average of 16.5 minutes per session" [23].
- EndeavorRx: "approximately 25 minutes per day for 5 days per week", с "lock-out after the allocated gameplay" [9].
- VR-тренировка ходьбы при ДЦП: "20–30 min per session, ≤4 times per week across ≥8 weeks" [24].
- Домашнее исследование экзерсайз-игр: назначено "30 minutes of activity, five times per week", сыграно "136 minutes per week" [25].
- ВОЗ, возраст 2–4 года: "sedentary screen time should be no more than 1 hour" [26].
- **Дизайн:** по умолчанию около 16.5 минут, жёсткая блокировка по времени; клиницист может поднять лимит.

**Обратная связь и награды.** Дети, получавшие урезанную обратную связь, запомнили навык хуже тех, кто получал "100% feedback", и им нужна "feedback reduced more gradually" [27]: отклик на каждый шаг, убирать медленно. "choice, reward, and goals, lead to increased motivation and engagement" [28]. Для ДЦП: "Reduce consequences of errors", "Make the game state visible", "Balance for effort" [25].

**Родители.** Эффективные программы были "developed with a collaborative, evidence-based approach and implemented by parents at home" [23]. Отчёты родителям уже есть у аналогов (строка 10): это обязательный минимум, не отличие.

**Нарушения моторики.** Экшен-игры оказались возможны "for children with CP at level III" по GMFCS [25], но в исследования Kinect и C-Mill брали только GMFCS I–II [6][11]. Базовые правила доступности: "adjust the game speed", "adjust the sensitivity of controls", "Offer a wide choice of difficulty levels" [29]. **Дизайн:** режим сидя с целями для рук для детей, которые не могут шагать самостоятельно.

## 4. Регулирование и формулировки

**Руководство FDA по general wellness** ("issued on January 6, 2026") [30]:

| Остаётся wellness (названо в руководстве) | Делает продукт медицинским изделием |
|---|---|
| "develop or improve endurance, strength or coordination" | "restore a structure or function impaired due to a disease or condition" |
| "improve general mobility or to assist individuals who are mobility impaired in a recreational activity" | "a computer game will diagnose or treat autism" |
| "improve mental acuity, instruction following, concentration" (вопросы в движении) | "references to specific diseases, clinical conditions, or diagnostic thresholds" |

Слово «равновесие» (balance) в руководстве не названо; подавать его как координацию или физическую форму. В одном из разобранных примеров сказано, что намёк на "use in a medical or clinical context" выводит продукт из wellness [30]: в этом риск отчёта для клинициста. EndeavorRx показывает другой путь: заявление о болезни, De Novo, только по рецепту [8][9]. **Дизайн:** писать *builds coordination, strength and endurance*; никогда не писать *rehab after injury*, *treats CP* или *detects decline*.

**COPPA:** "Child means an individual under the age of 13"; к персональной информации относятся "A photograph, video, or audio file where such file contains a child's image or voice" и биометрические идентификаторы, например "gait patterns; facial templates" [31]. Оператор "must obtain verifiable parental consent before collecting any personal information from a child" и хранит данные "only as long as is necessary" [32]. Правило изменено "April 22, 2025" [32], на соответствие дан "one year" [33]. **Дизайн:** оценка позы на устройстве, видео не загружается, хранятся только баллы, согласие родителей до первого занятия с камерой.

## 5. Рекомендация

Да: для детей основа продукта — игра с проекцией на устойчивый пол, без беговой дорожки ("Children shall not play with the appliance" [19]). Walking pad — дополнительный режим для подростков и взрослых в пределах возраста из инструкции модели ("14 ~ 60 years old" в одной из инструкций [20]), под присмотром, цели на экране, а не на ленте (**Дизайн**).

Чем продукт отличается от аналогов:
1. **Цели для шага на полу дома.** Проекция на пол стоит от $5,796 [2], $10,200 [4] или не подходит для дома [3]; приложения с веб-камерой выводят игру на экран [7][12][13]. Домашний проектор и камера телефона ставят цель туда, куда опускается стопа: игрой становятся постановка шага и высота подъёма стопы.
2. **Правила терапевта как жёсткие рамки.** AbilityPlay подстраивает сложность сам [13]; этот коуч подстраивается только в рамках, заданных клиницистом: блокировка по времени [9], медленно убираемая обратная связь [27], правила остановки.
3. **Безопасность и приватность по умолчанию.** Беговая дорожка доступна только с определённого возраста, заявления только в рамках wellness [30], видео обрабатывается на устройстве, поэтому изображение ребёнка и данные о походке не покидают дом [31].

## Источники

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
19. Инструкция TRR2F: https://dwn.alza.cz/manual/99690
20. Инструкция TRK12F: https://justmore.dk/images/media/ProductsDocs/Walkingpad%20TRK12F%20-%20vn998932481.pdf
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
