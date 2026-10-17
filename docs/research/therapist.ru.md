# Клиническая справка для AI-коуча: тренировка ходьбы и перешагивания препятствий

Дата: 2026-10-17

Цитаты рядом с [n] дословно взяты из источника n и оставлены на английском; (S) = вторичный источник; **Дизайн** = решение команды по умолчанию, не из источника. Реплики коуча и формулировки для продукта тоже оставлены на английском, так как это строки для интерфейса.

## 1. Структура занятия

**V-TIME** (беговая дорожка плюс VR на экране; пожилые люди с падениями, в том числе с болезнью Паркинсона) [1][2]
- "three times per week for 6 weeks, with each session lasting about 45 min" [2]; "bouts of walking and rest breaks", первое занятие "ideally 20 minutes of walking time" [1].
- Скорость: 1-я неделя "80% of over ground gait speed", 2-я неделя "90%", дальше "increase by 10% every week"; "1 minute of walking will be added to each of the walking bouts" [1].
- Препятствия: на 1-й неделе "every 30 seconds, at low level of difficulty", потом чаще и "on the more challenged side" [1].
- "If subjects are not successful, the difficulty level will be decreased to the level previously achieved and vice versa" [1].
- Обратная связь "both during training and as a summary at the end" [2].

**C-Mill** (цели и препятствия проецируются на ленту, как в этом продукте; пациенты стационара после перелома бедра) [3]
- "40 minutes per session", из них "20 minutes of practice".
- 1-я неделя: обычная ходьба, "so that participants will become acquainted"; 2-я неделя: цели для шага; 3-я неделя: препятствия; 4-я неделя: смена темпа и игры.
- Сложность препятствия задают размер и время на реакцию: "a few steps ahead [easy] or during the swing phase of an ongoing step [difficult]".

**Высота препятствия:** протокол для проецируемых препятствий не найден. В лабораторном исследовании препятствия были "0, 25, 51, or 152 mm"; "For the 25 mm obstacle, mean FC was 64 mm, or approximately three times that used in level gait" [4].

**Разминка:** ни в одном из двух испытаний не описана; в буклете Otago: "Always begin with a warm up" (S) [5].

**Доза по руководству:** упражнения для профилактики падений "three times or more weekly", с прогрессией "for at least 12 weeks" [6].

## 2. Безопасность

- **Скрининг:** PAR-Q+ [7] задаёт 7 вопросов, например "Do you lose balance because of dizziness OR have you lost consciousness in the last 12 months?" При любом ответе YES: "COMPLETE PAGES 2 AND 3".
- **Критерии испытаний:** V-TIME требовал "Able to walk for 5 minutes unassisted" и исключал "Unstable medical condition including cardio-vascular instability in the past 6 months" [1]; C-Mill исключал "not being allowed to bear weight on the affected leg" [3].
- **Остановка:** "chest pain, dizziness or severe shortness of breath, stop immediately"; при боли в суставе: "stop, check your position and try again" (S) [5].
- **Нагрузка:** по шкале 0–10 умеренная нагрузка это "5 or 6", интенсивная "begins at a 7 or 8"; при умеренной нагрузке человек "can talk, but not sing" [8]. Пороги остановки по шкале Борга и по пульсу на открытых страницах не найдены; датчика пульса в продукте нет, поэтому используем вопрос 0–10 и разговорный тест.
- **Опора:** в V-TIME использовали "A safety harness" при "no weight support" [1]; в C-Mill "handrails permit weight-bearing and allow early training in a safe environment" [3]. У walking pad нет ни того, ни другого.
- **Без присмотра:** оба испытания вёл персонал; дома пользователю следует "consult your GP" (S) [5]. Добавить (**Дизайн**): аварийную остановку, до которой можно дотянуться не глядя, ключ безопасности на клипсе, предел скорости, который задаёт врач или опекун, автоостановку у заднего края деки, блокировку после любого ответа YES в PAR-Q+.

## 3. Метрики

| Метрика | Референс | Одна боковая камера? |
|---|---|---|
| Скорость ходьбы | Риск падения "<0.8 m/s" на "4-m walking length" [6]; 70–74 года: мужчины 117±16, женщины 116±20 cm/s; 85+: 101±22, 98±20 [11] | Даёт только скорость ленты; несопоставимо |
| Каденс | 70–74: 102±8 (мужчины), 113±20 (женщины) steps/min; 85+: 102±11, 108±10 [11]; порог риска падений не найден | Да; ошибка времени шага "0.02 s" [9] |
| Длина шага | 70–74: 69±8 / 61±9 cm; 85+: 59±10 / 54±9 cm [11] | Да; ошибка "0.049 m" на шаг, "0.018 m" для среднего по человеку [9] |
| Коэффициент симметрии (большее/меньшее) | "1.0 denotes perfect symmetry"; асимметрия выше "1.08, 1.06 and 1.05" (длина шага, перенос, опора) [10] | Да, по шагам обеих ног |
| Timed Up and Go | CDC: "≥12 seconds" = "at risk for falling" [12]; руководство: ">15 seconds", доказательства "mixed" [6] | Нет; нужны стул, проход "3 meters", поворот [12] |
| Просвет стопы | При обычной ходьбе ≈21 mm (64 ÷ 3, выведено из [4]) | Вероятно; валидации не найдено |
| Ширина шага | 70–74, мужчины 9.7±3.0 cm [11] | Нет; в [9] не проверялась |

## 4. Обратная связь с точки зрения моторного обучения

- **Фокус внимания:** внешний "on intended movement effects", внутренний "on movements of body parts"; внешний выиграл по удержанию навыка, "Hedges' g value = 0.583" [13]. После поправки на публикационное смещение: удержание "g = 0.15", эффекты "small to nil" [14]. Внешние подсказки берём по умолчанию, но не называем их доказанными.
- **Частота:** "no significant effect of reduced feedback frequency at any time point"; "robust evidence ... is lacking" [15]. В РКИ по ходьбе с "a faded feedback schedule" ходьба улучшилась; "Visual feedback may be more likely to create dependence on external cues than auditory feedback" [17].
- **KR и KP:** "prescriptive KP alone was superior to KR; and KR was superior to descriptive KP"; "can be generalized only to novices" [16].
- **Формулировка подсказки (Дизайн):** не больше 12 слов, одно указание; называть цель на ленте, а не часть тела; говорить, что делать.

## 5. Заявления и регулирование

FDA "General Wellness: Policy for Low Risk Devices", выпущено "January 6, 2026" [18]:
- Может охватывать "exercise equipment, audio recordings, video games"; к wellness-заявлениям относятся "develop or improve endurance, strength or coordination", "multitasking", "Claims to improve general mobility".
- Не wellness: "A claim to restore a structure or function impaired due to a disease or condition", поэтому коучинг восстановления после травмы, скорее всего, уже территория медизделий. Падений нет среди примеров заболеваний в документе.
- Не wellness, если в интерфейсе есть "references to specific diseases, clinical conditions, or diagnostic thresholds" или подсказки, которые "recommend or require specific clinical action". Допустимо: "evaluation by a healthcare professional may be helpful", без "clinical thresholds".
- Проверка на низкий риск: может ли продукт "pose a risk to the safety of users"? Ответить на это для ленты без поручней.
- "powered treadmill" для "medical purposes, such as to redevelop muscles or restore motion to joints" относится к "Class I" [19].
- Результат V-TIME по падениям получен на тренировках в клинике под присмотром и в страховочной системе [1][2]; он не доказывает, что работает эта игра.

- **Говорить:** "walking game for balance, coordination and focus"; "practice stepping over obstacles"; "your steps today vs last time"; "a check-in with your clinician may be helpful".
- **Избегать:** "treats", "rehab", "therapy", "prevents falls", "reduces fall risk", "clinically proven", "fall-risk score", "abnormal", "below 0.8 m/s", а также называть заболевание или травму.

## 6. Спецификация коуча

**Параметры по умолчанию** (**Дизайн**, если не указан источник)

| Параметр | Значение |
|---|---|
| Предварительная проверка | PAR-Q+ [7]; при любом YES без присмотра не занимаемся |
| Разминка | 2 min ходьбы без целей [3] |
| Стартовая скорость | 80% от скорости ходьбы по полу [1]; если неизвестна: минимум дорожки, поднимать, пока человек "talk, but not sing" [8] |
| Занятие | 3 подхода × 5 min, отдых 1 min; постепенно до 20 min ходьбы [1]. Демо: один подход 3 min |
| Препятствия | 1 раз в 30 s [1], показывать за несколько шагов [3] |
| Порог подъёма стопы | Старт 5 cm, диапазон 5–15 cm (в пределах [4]) |
| Порядок | цели, препятствия, вопросы, затем поздние препятствия [3] |
| Прогрессия | Меняем один параметр за раз; 8 из последних 10 успешно: уровень вверх; 4 из 10 неудачно: уровень назад [1]. Скорость меняем только между занятиями, не больше +10% в неделю [1] |
| Обратная связь | Звук на каждую цель или препятствие (KR); одна предписывающая голосовая подсказка раз в 20–30 s; итог в конце подхода [2] |
| Нагрузка | В каждом подходе спрашивать "Effort, zero to ten?"; цель 5–6 [8] |

**Ситуации** (триггеры: **Дизайн**)

| Ситуация | Триггер | Действие | Пример реплики |
|---|---|---|---|
| Тревожный симптом | Боль в груди, головокружение, одышка, стойкая боль в суставе [5], "stop" | Остановить ленту, закончить занятие, показать совет обратиться к врачу | "Stopping now. Keep stepping slowly until the belt stops." |
| Спотыкание или смещение назад | Стопа в задней четверти деки | Остановить ленту | "Stopping. Small steps until the belt stops." |
| Высокая нагрузка | Нагрузка ≥7 или не может договорить короткий ответ | Скорость −10% или конец подхода; убрать вопросы | "Let's ease off. Comfortable steps, easy breathing." |
| Успех с препятствиями | 8 из последних 10 пройдены | Уровень вверх | "Nice clearing! The next ones come a little sooner." |
| Задевания препятствий | 4 из последних 10 ниже порога | Уровень назад | "Step high over the red bar." |
| Асимметрия левой и правой стороны | Коэффициент длины шага >1.08 на протяжении 20 шагов [10] | Расставить цели так, чтобы удлинить короткую сторону | "Reach for the left circles and land right on them." |
| Частые короткие шаги | Каденс +15% и длина шага −10% относительно разминки | Шире и медленнее цели | "Long, steady steps. Land on each circle." |
| Усталость | Длина шага −10% относительно начала подхода, больше промахов | Закончить подход, отдых 1–2 min | "Great work. Rest a minute, then one more round." |
| Падение качества при двойной задаче | Промахи или укорочение шага во время ответа | Вопрос проще или без вопросов | "Just walk for now. Questions come back soon." |

Коуч никогда не называет заболевания, не приводит клинические пороги, не говорит "abnormal" и не даёт медицинских советов [18].

## Источники

1. Mirelman 2013: https://pmc.ncbi.nlm.nih.gov/articles/PMC3602099/
2. Mirelman 2016 (рукопись): https://eprints.ncl.ac.uk/227328
3. van Ooijen 2013: https://pmc.ncbi.nlm.nih.gov/articles/PMC3637244/
4. Chen 1991: https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:1940078&resultType=core&format=json
5. (S) Буклет Otago: https://westsussex.everyonehealth.co.uk/wp-content/uploads/sites/4/2023/08/LLT-OEP-Booklet-Beginners-V4a-2018.pdf
6. Montero-Odasso 2022: https://pmc.ncbi.nlm.nih.gov/articles/PMC9523684/
7. PAR-Q+ 2025: https://southlake.ca/wp-content/uploads/2025/02/PARQPlus2025-Form-fillable.pdf
8. CDC: https://www.cdc.gov/physical-activity-basics/measuring/index.html
9. Stenum 2021: https://pmc.ncbi.nlm.nih.gov/articles/PMC8099131/
10. Patterson 2012: https://pmc.ncbi.nlm.nih.gov/articles/PMC3914537/
11. Hollman 2011: https://pmc.ncbi.nlm.nih.gov/articles/PMC3104090/
12. CDC STEADI: https://www.cdc.gov/steadi/pdf/steadi-assessment-tug-508.pdf
13. Chua 2021: https://digitalscholarship.unlv.edu/kns_fac_articles/424
14. McKay 2024: https://raw.github.com/cartermaclab/carterlab-papers/main/2024_mckay-etal_reporting-bias-not-external-focus-a-robust-bayesian-meta-analysis-and-systematic-review-of-the-external-focus-of-attention.pdf
15. McKay 2022: https://api.openalex.org/works/W4214725672
16. Oppici 2021: https://api.openalex.org/works/doi:10.1080/1750984X.2021.1986849
17. Spencer 2021: https://pmc.ncbi.nlm.nih.gov/articles/PMC8042129/
18. FDA 2026: https://www.fda.gov/media/90652/download
19. 21 CFR 890.5380: https://www.ecfr.gov/api/versioner/v1/full/2026-10-01/title-21.xml?part=890&section=890.5380
