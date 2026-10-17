# Железо: проекционная PT-игра на беговой дорожке

Дата: 2026-10-17. Метка в скобках ведёт к источнику в конце, у каждого есть дословная цитата. «Арифметика» — наши собственные расчёты.

## Решения

- **Проектор:** нужен проектор со стандартной проекцией (throw ratio примерно 1.25–1.7) и яркостью от 3,000 люмен. Короткофокусный не подходит, мини-проектор на 300–500 lm тоже. Сегодня покупаем **Epson EpiqVision Flex CO-W01** ($399.99) [P1][P2]. **ViewSonic LS510WH-2** подходит лучше: он светодиодный и допускает монтаж под любым углом [P3]. Но брать его стоит, только если он найдётся в городе по нормальной цене.
- **Камера:** берём вебкамеру, которая уже есть, и подключаем её к ноутбуку. 30 fps достаточно, 720p60 лучше. Logitech C922 покупаем, только если ваши камеры не выдают больше 30 fps [C5].
- **Поза:** считаем на ноутбуке через MediaPipe Pose (модель lite или full). Pi не используем: он не запускает модель и не стримит кадры.
- **Датчики:** KY-037/038 не берём. По желанию можно приклеить один пьезодиск под деку и читать его на ESP32 как сигнал «стопа встала». Левую и правую ногу различаем по камере.

## 1. Проектор

**Проекционное расстояние (арифметика).** Ширина картинки W = D / TR. Чтобы покрыть 1.2 m ленты с расстояния 1.5–2.0 m, нужен TR 1.25–1.67. При D = 1.8 m:

- CO-W01 даёт 1.05–1.42 m в ширину.
- LS510WH-2 даёт 1.15–1.38 m в ширину.
- Короткофокусный (TR 0.5) даёт 3.6 m. Площадь в 9 раз больше, поэтому на ленту попадает лишь девятая часть света.

**Яркость (арифметика).** Картинка 1.3 × 0.81 m — это около 1.05 m².

- 3,000 lm дают на ней примерно 2,800 lux до потерь.
- 450 lm дают около 430 lux, то есть всего лишь уровень офисного света (320–500 lux) [P9]. Тёмная лента делает картинку ещё хуже.

| Модель | Источник | Люмены | TR | Keystone | HDMI | Вес | Цена |
|---|---|---|---|---|---|---|---|
| Epson CO-W01 | лампа, 188 W | 3,000 | 1.27–1.71 | ±30° | 1 | 2.4 kg | $399.99 [P1][P2] |
| ViewSonic LS510WH-2 | LED, 360° | 3,000 ANSI | 1.3–1.56 | ±40° V | 1 | 5.8 lb | не подтверждена: восстановленный за $399.99 распродан [P4]; на eBay просят $1,011.70 [P5] |

**Где купить.**

- **Best Buy:** наличие в магазинах проверить не удалось, сайт нас заблокировал. Смотрите фильтр «Pickup today» в приложении.
- **Micro Center:** в штате Washington магазина нет (данные на ноябрь 2025) [P10].
- **Amazon:** сервис Amazon Now в Seattle возит товары для дома [P11]. Доставка проектора в тот же день не подтверждена.

**Наклон.** На страницах CO-W01 допустимый наклон не указан. На одной странице руководства Epson (модель не названа) сказано, что наклон больше трёх градусов может повредить проектор [P7]. Значит, направлять ламповый проектор круто вниз — режим недокументированный. Варианты:

- взять LS510WH-2;
- держать проектор горизонтально и опускать луч вниз зеркалом под 45°.

**Крепление.** Нужна световая стойка со штангой, например Neewer: высота 3 m, нагрузка на штангу 5 kg, мешок с песком в комплекте, $99.99 [M1]. Любой из двух проекторов (2.4–2.7 kg) в эту нагрузку укладывается. Glazer's Camera (811 Republican St, Seattle) продаёт штанги, например одну с нагрузкой 8 kg за $49.90 [M2]; наличие мы не проверяли.

Установка:

1. Стойку ставим у переднего угла дорожки.
2. Штанга заходит только на передние 20–30 cm ленты.
3. Объектив — на высоте 1.8–2.0 m над декой, направлен назад, к идущему.
4. Остаточный перекос убираем программно, гомографией по 4 углам.

**Безопасность.** Epson запрещает ставить проектор на неустойчивую стойку и требует страховать его тросом [P8]. Для стойки со штангой рекомендуют мешок-противовес [M2].

- Мешок с песком кладём на ноги стойки.
- От проектора к стойке ведём страховочный шнур.
- Штанга никогда не должна оказаться над головой идущего.
- Кабели приклеиваем скотчем подальше от ленты.

## 2. Камера

- **Частота кадров.** Видео сбоку на 25 Hz дало среднюю ошибку времени шага 0.02 s [C1]. На 60 Hz шаги определялись с точностью до 2–5 кадров [C2]. При 30 fps кадр длится 33 ms (арифметика), для обратной связи в игре этого хватает.
- **Камеры Pi.**
  - Camera Module 3: 66° по горизонтали (Wide: 102°), 1536×864 при 120 fps.
  - Global Shutter: 1456×1088 при 60 fps [C3].
  - Шлейфы бывают на 200/300/500 mm [C4]. Официальную максимальную длину мы не нашли.
- **Вебкамера.** C922 снимает 720p при 60 fps, угол обзора 78° по диагонали, $119.99 [C5]. Пассивный кабель USB 2.0 — до 5 m [C6].
- **Покрытие (арифметика).** Ширина кадра равна 2·d·tan(HFOV/2). С 1.5 m объектив 66° покрывает 1.95 m, а C922 (около 70° по горизонтали) — около 2.1 m. Вся лента в кадр помещается.
- **Где ставить.** Сбоку ближняя нога закрывает дальнюю стопу; в исследовании на 25 Hz стояло по камере с каждой стороны [C1]. Если камера одна, ставьте её на высоте лодыжек спереди по диагонали.

## 3. Скорость позы: Pi против ноутбука

| Платформа | Модель | Замер |
|---|---|---|
| Pi 4 CPU | MoveNet Lightning INT8 | 95 ms/кадр (≈10 fps) [T1] |
| Pi 5 CPU | MoveNet MultiPose 256×256 | 17 fps (S) [T2] |
| reComputer R1000 + Hailo-8L | YOLOv8 pose 640×640 | 0.5 → 27 fps (S) [T3] |
| MacBook Pro 15" 2019 | BlazePose lite/full/heavy | 92/81/38 fps [T4] |

Сквозного замера fps для Pi 5 с AI HAT+ мы не нашли. Ноутбук без всякого дополнительного железа выдаёт примерно в 5–9 раз больше, чем Pi на CPU. Сравнение грубое: модели разные.

## 4. Датчики шагов

- **KY-037/038.** Это плата с компаратором LM393, производитель пишет: «ideally suited for threshold value measurement» [S1]. Ни один источник не показывает, что она выделяет удары пяток на фоне шума мотора. Не берём.
- **Пьезо.** Параллельно ставим резистор 1 MΩ и читаем через `analogRead()` [S2]. Стоит $0.95 за штуку [S3].
- **Лево/право.** Напольные геофоны определяли временные параметры походки с точностью 90.5% (RMSE 0.08 s). Но левую и правую ногу там размечали по чередованию шагов, а не по положению датчиков [S4]. Исследований на беговой дорожке, где ноги различают двумя датчиками под декой, мы не нашли. Два пьезо на одной жёсткой деке не помогут надёжно отличить левую ногу от правой.
- **АЦП.** ESP32 сэмплирует с частотой 20 kHz–2 MHz, разрядность 12 бит [S5]. Используйте пины ADC1: ADC2 занят Wi-Fi [S6]. У Pi аналоговых входов нет [S1], ему понадобится MCP3008 (200 ksps) [S7].

## 5. Список покупок

| Что | Зачем | Модель / параметры | Цена | Где | Приоритет |
|---|---|---|---|---|---|
| Проектор | картинка игры | Epson CO-W01 | $399.99 | Best Buy (наличие не проверено) | обязательно |
| Стойка + штанга + мешок | крепление | Neewer 3 m, 5 kg | $99.99 | Neewer/Amazon или Glazer's | обязательно |
| Адаптер крепления, страховочный шнур, gaffer-скотч | закрепить, застраховать | полка или универсальное крепление, 1/4"-20 | не проверено | Glazer's / Best Buy | обязательно |
| HDMI 15 ft + USB-C→HDMI | ноутбук → проектор | — | не проверено | Best Buy | обязательно |
| Вебкамера 720p60 | точнее тайминг | Logitech C922 | $119.99 | Best Buy / Logitech | желательно |
| 2 пьезо + 1 MΩ | триггер шага | пьезо в корпусе | $1.90 | хардварный стол / Adafruit | желательно |

**Итого:**

- Обязательные позиции с подтверждённой ценой — $499.98, плюс позиции с непроверенной ценой.
- Вместе с желательными — $621.87.

## Источники

(S) — вторичный источник. Цитаты оставлены на языке оригинала.

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
- T1 "MoveNet.Lightning (INT8 quantized) ... 95ms" (колонка Raspberry Pi 4) https://blog.tensorflow.org/2021/08/pose-estimation-and-classification-on-edge-devices-with-MoveNet-and-TensorFlow-Lite.html
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
