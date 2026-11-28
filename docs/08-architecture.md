# 08. Архитектура

## 1. Стек

| Слой | Технология | Примечание |
|---|---|---|
| Язык | TypeScript 5.x, `strict` | |
| Движок | Phaser 4.x (на ноябрь 2026 ветка 4.2) | Рендерер WebGL. Сверяться с документацией v4, не v3 |
| Сборка | Vite | |
| Нативная оболочка | Capacitor 8.6.2 (плагины `app` 8.1.2, `haptics` 8.0.2, `preferences` 8.0.1, `splash-screen` 8.0.2) | Подключена на M7 (сессия 8). Capacitor 9 ожидается в конце ноября 2026: обновиться после стабилизации плагинов. Проекты `ios/` (Swift Package Manager) и `android/` лежат в репозитории, `capacitor.config.json` в корне |
| Тесты | Vitest | Только для `src/core` и `src/services` (заглушки) |
| Линтер | ESLint + Prettier | |
| Пакетный менеджер | npm | |
| Нативные зависимости iOS | Swift Package Manager | Не CocoaPods: его реестр закрывается на запись в декабре 2026 |

Версии уточнять командой `npm view <пакет> version` в момент установки и фиксировать в `package.json` точно (без `^`) для движка и Capacitor.

## 2. Структура проекта

### Темы внутри слоёв

Верхний уровень `src/` разложен по слоям (раздел 3). Внутри слоёв `data/`, `core/`, `game/fx/`, `game/objects/`, `game/ui/` и в корне `game/` файлы лежат в подпапках по темам (сессия 6в, таблица переноса «старый путь → новый путь»: `_archive/08a-file-map.md`). Названия тем одни и те же во всех слоях; тема есть в слое, только если в нём есть её файлы.

| Тема | Что в ней |
|---|---|
| `tower` | слои башни, бросок, полёт, качка, обвал, придавливание края, простые слои, отрисовка слоя |
| `creatures` | существа, лица, сон и зевок, способности, мастерство, портреты, бригада |
| `glaze` | подтёки, слизывание, язык |
| `cuts` | срезы |
| `toppers` | украшения, их придавливание, кремовый валик |
| `guests` | гость на башне, космический гость |
| `zones` | зоны, правила зон, табличка зоны, круги (витки), контрольные точки |
| `weather` | погода забега, уличная погода, погода на башне, снежная пыль, молния |
| `backdrop` | фоны; в `game/objects/backdrop/` внутри разбиты на `zones`, `weather`, `panorama`, `life`, `space`, `common` |
| `economy` | монеты, ягоды, магазин, подарок, печь, сокровища, реклама за награду, покупки |
| `progression` | уровни, задания, серия, башня дня, рекорды, коллекция, журнал пекаря |
| `journal` | картинки журнала пекаря (значки, посуда; только в `game/fx/`) |
| `games` | игровые сервисы платформы: таблицы рекордов и достижения Game Center (`data/games/`: идентификаторы, пороги, кубок; `game/games/`: отправка счёта и достижений, действия кнопок; `game/fx/games/`: картинка кубка) |
| `cloud` | облачное сохранение: связь копии в облаке с сохранением (`game/cloud/`: чтение, запись, решения на Home; `game/ui/menu/cloud/`: окна «Найден прогресс» и «Два сохранения») |
| `run` | запуск и завершение забега, камера, «Продолжить?», итоги, старт с точки, HUD забега |
| `audio` | звук и музыка вне `services/` |
| `app` | конфигурация, ключи сцен, настройки, жизненный цикл, рендерер, экран |
| `tutorial` | обучение (в `data/`; в `game/` это уже папка `game/tutorial/`) |
| `debug` | инструменты разработки и замера (в `data/`; в `game/` это папки `game/debug/` и `game/perf/`) |
| `common` | общее для слоя, что не относится ни к одной теме (кнопка, текст с обводкой, атлас, кривые, частицы) |

В `game/ui/menu/` подпапки по экранам и окнам: `home`, `collection`, `detail`, `team`, `daily`, `shop`, `results`, `streak`, `missions`, `oven`, `new-creature`, `settings`, `checkpoint`, `journal`, `climb-map`, `cloud`, `widgets` (общие виджеты меню).

Правила:
- Новый файл кладётся в папку своей темы внутри слоя. Если файл подходит двум темам, он идёт туда, откуда его чаще импортируют.
- В одной папке не больше 40 файлов вместе с тестами, `common/` тоже. Это проверяет тест `scripts/folder-size.test.ts`; исключения перечислены в нём явным списком с причиной.
- Новая тема получает свою подпапку и строку в таблице выше; названия тем одинаковы во всех слоях.
- Папка, которой стало тесно, делится на подпапки внутри своей темы (так `game/objects/tower/edge-squash/`). Это касается и папок без тем из списка ниже: так `game/fx/abilities/` поделена на семейства способностей (правка по приёмке 6в, цель — не больше 25 файлов в папке).
- Тест лежит рядом со своим модулем. Импорты относительные; псевдонимов путей и файлов `index.ts` для реэкспорта нет.
- Без подпапок по темам остаются: `game/scenes/` (одна сцена на файл), `game/debug/`, `game/perf/`, `game/tutorial/`, `game/fx/abilities/` (внутри по семействам способностей, а не по темам), `game/ui/style/` (общий набор интерфейса), `core/save/`, `core/abilities/`, `state/`, `services/*`, `util/` (кроме `util/boot/`: встроенный скрипт загрузочного экрана), `i18n/`.

### Дерево

```
tippy-treats/
├── CLAUDE.md
├── README.md
├── docs/
├── index.html
├── package.json
├── vite.config.ts
├── capacitor.config.json
├── .env.example
├── assets/
│   ├── svg/            лица, иконки, элементы интерфейса, фоны
│   ├── fonts/          Nunito
│   ├── music/          треки музыки (m4a, AAC), лицензии в LICENSES.md
│   └── LICENSES.md
├── ios/                создаётся Capacitor (этап M7)
├── android/            создаётся Capacitor (этап M7)
├── .github/workflows/  ios.yml и android.yml: сборки в GitHub Actions, только ручной запуск (11a-device-build.md)
├── site/               сайт игры: политика, условия, поддержка, en и ru (11-release-store.md, раздел 9)
├── scripts/
│   ├── sim.ts          бот-симуляция для баланса
│   ├── dev-tools.cjs   общее для браузерных скриптов: параметры, свой vite, поиск Playwright
│   ├── store/          npm run store:shots: скриншоты для сторов (11-release-store.md, раздел 5)
│   ├── native/         сборка AAB, иконки, ключ загрузки, версия приложения, проверка манифестов конфиденциальности
│   ├── site/           выкладка и страж сайта (`site-guard.test.ts`)
│   ├── folder-size.test.ts   не больше 40 файлов в папке src
│   ├── secrets-guard.test.ts в отслеживаемых файлах нет ключей рекламы, покупок и Firebase
│   └── docs-guard.test.ts    в docs нет управляющих символов и таблиц без шапки, ссылки из кода на docs и пути в описаниях живые
└── src/
    ├── main.ts         точка входа: конфигурация Phaser, запуск сервисов
    ├── core/           ЧИСТАЯ ЛОГИКА. Без Phaser, Capacitor, DOM
    │   ├── tower/
    │   │   ├── tower-sim.ts        симуляция забега (машина состояний); тесты tower-sim-*.test.ts по частям
    │   │   ├── sim-types.ts        типы состояния, событий и конфигурации забега
    │   │   ├── drop.ts             расчёт результата броска
    │   │   ├── wobble.ts           качка
    │   │   ├── flight.ts           движение летящего слоя: стены, правила зон, ожидание, обманка, облака
    │   │   ├── miss.ts             промах: щит, окно продолжения или конец забега
    │   │   ├── scoring.ts          очки, комбо
    │   │   ├── field.ts, speed-curve.ts, tempo-ease.ts   поле, кривая скорости, смягчение темпа
    │   │   ├── bot.ts              бот игрока для симуляции
    │   │   └── sim-test-utils.ts   доступ тестов к состоянию симуляции
    │   ├── creatures/
    │   │   ├── team.ts             слоты бригады: открытые слоты, поставить, убрать, бригада забега из сохранения, порядок 6 → 12 → 18
    │   │   ├── team-place.ts       поставить существо в выбранный слот (перетаскивание): перенос, обмен, замена
    │   │   ├── team-queue.ts       расписание существ бригады, «следующее существо»
    │   │   ├── mastery.ts          мастерство существ для экранов
    │   │   └── ability-values.ts   числа текста способности на уровне и что растёт со следующим
    │   ├── abilities/          по файлу на способность + registry.ts
    │   ├── zones/
    │   │   ├── zones.ts            правила зон, расписание событий по зерну
    │   │   ├── checkpoints.ts      оплата старта с контрольной точки
    │   │   └── space-laps.ts, space-planet.ts   витки «Космоса» и их планеты
    │   ├── guests/space-visitor-pick.ts   гости «Космоса» по зерну
    │   ├── weather/run-look.ts     вид забега: погода и место старта по зерну
    │   ├── economy/
    │   │   ├── coins.ts            чистые правила монет (парящая монета, комбо, бонус высоты)
    │   │   ├── run-coins.ts        монеты забега: начисление и события выплат
    │   │   ├── berries.ts          ягоды забега: `berriesFromEvents`
    │   │   ├── economy.ts          кошелёк, покупки, прокачка, обмен ягод (`spend`, `buyCreature`, `upgradeCreature`, `exchangeBerries`),
    │   │   │                       награда-существо и замена дубликата (`grantCreature`, `duplicateCompensation`)
    │   │   ├── shop.ts             правила магазина: стартовый набор (срок, состав, замена дубликата), бесплатные монеты, существа за монеты по уровню, выдача товара
    │   │   ├── gift.ts             бесплатная коробка: готовность, сумма от `installId` и времени, остаток ожидания
    │   │   ├── oven.ts             «Свежая печь» опыта
    │   │   ├── double-coins.ts     счётчик удвоений за день
    │   │   ├── first-runs.ts       первые забеги без продаж
    │   │   └── video-policy.ts     когда предлагать рекламу за награду (`canOfferDoubleCoins`) и когда показывать межстраничную (`canShowInterstitial`, `shouldOfferRemoveAds`)
    │   ├── progression/
    │   │   ├── progression.ts      опыт, уровень пекаря, награды
    │   │   ├── missions.ts         выбор и прогресс заданий
    │   │   ├── streak.ts           серия дней: вход, календарь, награда, восстановление, отказ, день забега
    │   │   ├── daily.ts            башня дня: зерно, бригада, попытки, ступени наград, `recordDailyRun`
    │   │   ├── day-count.ts        счётчик одного местного дня
    │   │   ├── record-unlocks.ts   существа за рекорд высоты
    │   │   ├── achievements.ts     проценты достижений Game Center по сохранению, только выросшие (`achievementPercents`, `risenAchievements`)
    │   │   ├── leaderboards.ts     счёт таблиц рекордов по сохранению: таблица дня только сегодняшняя, верхняя граница (`boardScores`, `newScores`)
    │   │   └── collection.ts       способ получения закрытого существа, счётчик коллекции
    │   ├── run/
    │   │   ├── run-result.ts       итог забега
    │   │   ├── run-tally.ts        монеты по источникам, число способностей и наибольшая качка за забег
    │   │   ├── continue-offer.ts   что показывает окно «Продолжить?» (или ничего)
    │   │   └── near-miss.ts        строка «почти получилось» на результатах
    │   ├── common/
    │   │   ├── rng.ts              генератор с зерном (mulberry32)
    │   │   └── weighted-pick.ts    выбор по весам
    │   └── save/
    │       ├── schema.ts       типы сохранения, `HINT_IDS`
    │       ├── migrations.ts   цепочка миграций (`migrate`, цепочку можно подменить в тесте)
    │       ├── defaults.ts     новое сохранение
    │       ├── load.ts         `loadSave` (основное, копия, новое), нормализация, `serializeSave`, `readStoredSave` (одна копия сохранения: миграция, нормализация, целость)
    │       ├── sync.ts         `sync.dirty`: `withProgressChanged`, `NEVER_SYNCED`
    │       ├── cloud-merge.ts  облачная копия: разбор текста (`readCloudText`), решение по таблице слияния (`decide`), новая копия (`nextCopy`), правило первой записи
    │       └── save.test.ts
    ├── data/           ВСЕ ЧИСЛА И КОНТЕНТ
    │   ├── tower/              balance.ts, plain-layers.ts (простые слои), edge-squash.ts (придавливание края), tower-sparkles.ts
    │   ├── creatures/          creatures.ts, creature-looks.ts (рецепты рисунка и лица), creature-materials.ts (материал: приземление,
    │   │                       колыхание, покой, частицы), creature-style.ts, rarity.ts, mastery.ts, mastery-look.ts, master-anim.ts,
    │   │                       ability-anim.ts (числа и цвета анимаций способностей), rainbow-look.ts, transform-scene.ts
    │   ├── glaze/              glaze-drips.ts, lick.ts
    │   ├── cuts/               cut-look.ts
    │   ├── toppers/            plain-toppers.ts, topper-squash.ts
    │   ├── guests/             tower-guest.ts, space-visitor.ts
    │   ├── zones/              zones.ts (зоны и числа правил), rule-anim.ts (визуал правил зон: контур рывка, полосы скорости, облако,
    │   │                       обманка), zone-plate.ts (плашка зоны), checkpoints.ts, checkpoint-look.ts, lap-edge.ts, space-planets.ts, start-places.ts
    │   ├── weather/            weather.ts, weather-look.ts, street-weather.ts, tower-weather.ts, window-look.ts
    │   ├── backdrop/           backdrop.ts, backdrop-colors.ts, backdrop-life.ts, backdrop-far.ts, backdrop-mountains.ts, flight-clear.ts
    │   ├── economy/            economy.ts (цены прокачки, пакеты обмена ягод), shop.ts (товары за деньги по ключу, 7 дней набора, 25 монет × 3 в день),
    │   │                       gift.ts, iap-stub.ts (цены и вид окна заглушки покупок), rewarded-video.ts (вид и время заглушки рекламы),
    │   │                       first-runs.ts, treasure-anim.ts (монеты, ягоды, счётчики, золотой слой), treasure-piles.ts и вид наград
    │   │                       (berry-look, chest-look, gift-look, oven-look, reward-look, video-icon-look, offline-look)
    │   ├── progression/        progression.ts (XP за уровень, награды уровней), missions.ts, streak.ts, daily.ts
    │   ├── run/                continue-anim.ts (замедление промаха, окно «Продолжить?», пунктир и вымпелы линии рекорда), hud-layout.ts (раскладка HUD),
    │   │                       demo.ts (демо «Попробовать»), share.ts
    │   ├── audio/              sfx.ts, sfx-life.ts, audio-mix.ts, music.ts, sound-trim.ts, weather-bed.ts
    │   ├── app/                screen.ts, effect-levels.ts, storage.ts (ключи хранилища, задержка записи), save-defaults.ts (начальное состояние
    │   │                       нового сохранения), clock.ts (допуск перевода часов), boot.ts, app-info.ts, haptics.ts
    │   ├── games/              boards.ts (идентификаторы таблиц и верхняя граница счёта), achievements.ts (29 достижений: идентификаторы, пороги, очки), trophy-art.ts (части кубка «Таблицы дня»)
    │   ├── tutorial/           tutorial-anim.ts (вид и время подсказок обучения)
    │   ├── debug/              perf.ts, soak.ts, art-sheet.ts, clip-guard.ts, fps-meter.ts, lineup.ts, results-demo.ts, sim-teams.ts
    │   └── common/             anim.ts, palette.ts, idle-motion.ts (правило «нет неподвижных объектов»), menu-layout.ts (раскладка экранов меню),
    │                           shared-atlas.ts (страницы общего атласа), picture-fields.ts, bar-look.ts, hop-motion.ts
    ├── game/           ОТРИСОВКА (Phaser)
    │   ├── app/                config.ts, scene-keys.ts (ключи сцен, переходы `openScreen`, `startRunFrom`, `launchRun`, `goNext`, данные сцен),
    │   │                       apply-settings.ts (сохранённые настройки в сервисы и режим эффектов), effects-mode.ts, frame-work.ts,
    │   │                       webgl-renderer.ts, render-density.ts, follow-density.ts, safe-sides.ts
    │   ├── run/                run-request.ts (обычный забег, башня дня или демо: `CLASSIC_RUN`, `DAILY_RUN`, `demoRun`), run-setup.ts (бригада,
    │   │                       зерно, обучение и запись забега), run-goals.ts (цели линии своего результата из сохранения), run-recorder.ts (запись забега один раз, `extrasOf`), run-info.ts (снимок для
    │   │                       HUD и отладки), run-camera.ts (следование за башней, вход мира сверху), camera-layout.ts (математика прокрутки:
    │   │                       trayScrollY, targetScrollY, FLYING_REACH), continue-flow.ts (ход после промаха: окно, реклама, оплата, отказ),
    │   │                       continue-input.ts, run-exit.ts (куда уходит забег без результатов), run-restart.ts, results-data.ts,
    │   │                       results-launch.ts, checkpoint-start.ts, drop-driver-slot.ts, run-telemetry.ts
    │   ├── economy/            purchases.ts, rewarded.ts, interstitial-flow.ts, ad-caption.ts, treasure-events.ts
    │   ├── audio/              audio-lifecycle.ts, audio-unlock.ts, music-cues.ts, fx-sound.ts, weather-bed.ts
    │   ├── weather/            run-look-choice.ts
    │   ├── games/              games-sync.ts (отправка счёта и достижений при входе и после забега), games-actions.ts (вход по кнопке, окна таблиц и достижений, тихий вход на Home), games-telemetry.ts
    │   ├── cloud/              cloud-sync.ts (чтение, решение, запись копии, состояние для настроек), cloud-actions.ts (связка при запуске, поводы записи), cloud-ask.ts (окна облака первыми при входе на Home), cloud-summary.ts (что окна показывают о сохранении, «N мин назад»), cloud-demo.ts (образцы окон для кнопки «Cloud windows» панели отладки)
    │   ├── common/             fx-guard.ts (страховочная обёртка декораций), per-scene.ts (`PerScene`: объект на один запуск сцены),
    │   │                       dev-warn.ts (предупреждение только в разработке), depth.ts (порядок отрисовки), clip-guard.ts (страж обрезки)
    │   ├── tutorial/           обучение: `tutorial-director.ts` (когда что показывать), `timeline.ts`, подсказки
    │   │                       `tap-hint.ts`, `perfect-hint.ts`, `caption-hint.ts`, `tutorial-hints.ts`, `hint-spot.ts` (выбор места плашки), `hint-textures.ts`
    │   ├── scenes/
    │   │   ├── boot-scene.ts
    │   │   ├── home-scene.ts
    │   │   ├── new-creature-scene.ts  сцена нового существа (коробка, лучи, имя по буквам)
    │   │   ├── game-scene.ts
    │   │   ├── hud-scene.ts        интерфейс поверх забега
    │   │   ├── results-scene.ts
    │   │   ├── team-scene.ts
    │   │   ├── collection-scene.ts
    │   │   ├── creature-detail-scene.ts
    │   │   ├── daily-scene.ts      экран башни дня
    │   │   └── shop-scene.ts       магазин: блоки `ui/menu/shop/`, покупки через `game/economy/purchases.ts`
    │   ├── objects/
    │   │   ├── tower/              tower-view.ts, layer-view.ts (слой: картинка, лицо, анимации), layer-art.ts, layer-art-slot.ts (кэш
    │   │   │   │                   запечённой картинки слоя), layer-rig.ts (вспышка, прыжок, прозрачность, разрез «Двойняшек»),
    │   │   │   │                   flying-layer-view.ts, sway-hold.ts («замороженная» качка при чихе), tray.ts (поднос: покой и блик),
    │   │   │   │                   простые слои (plain-*), украшения поверх них (decor-*), тени, обвал (collapse-*), приземление
    │   │   │   └── edge-squash/    придавливание края летящего слоя
    │   │   ├── creatures/          creature-portrait.ts (живое существо для меню), лицо (layer-face.ts, face-*.ts), сон (sleep-*.ts),
    │   │   │   │                   материал (layer-material.ts, форма из material-shape.ts, sponge-*), значки существ, рост мастерства
    │   │   │   └── creature-art/   12 рисовальщиков существ (baked, creamy, layered)
    │   │   ├── glaze/              подтёки глазури (glaze-*), слизывание (lick-*, face-lick.ts, juice-lick-plan.ts), язык (tongue-*, strip-rope.ts)
    │   │   ├── toppers/            layer-topper.ts, topper-look.ts
    │   │   ├── guests/             гость на башне (tower-guest*.ts)
    │   │   ├── weather/            погода на башне (tower-weather-*.ts), сугробы на выступах (layer-drifts.ts, drift-geometry.ts)
    │   │   ├── economy/            floating-coin.ts (парящая монета на строке посадки)
    │   │   ├── run/                continue-driver.ts
    │   │   ├── common/             svg-textures.ts (картинки из assets/svg)
    │   │   └── backdrop/           фоны зон
    │   │       ├── common/         backdrop.ts (контроллер, кросс-фейд, прилавок), sky-gradient.ts, art-kit.ts
    │   │       ├── zones/          по файлу на зону (`kitchen-zone.ts` … `stars-zone.ts`), zone-scenery.ts (одна зона), zone-fade.ts,
    │   │       │                   zone-mix.ts, zone-prep.ts (подготовка следующей зоны заранее по шагам), worktop.ts (кухонный прилавок),
    │   │       │                   магазин (shop-*), горы (mountains.ts, mountain-placement.ts), far-plane.ts
    │   │       ├── weather/        погода на весь экран (run-weather.ts, weather-*.ts), уличная погода, погода за окном, снежная пыль, молния
    │   │       ├── panorama/       панорамное окно (panorama-*.ts, window-paint.ts, glass-motion.ts)
    │   │       ├── life/           life.ts (Hover, PuffColumn, Traveler, Twinkles), life-motion.ts, layer-life.ts, layer-anchor.ts, pass-timer.ts, guest-source.ts
    │   │       └── space/          space-zone.ts, планеты (dessert-planets.ts, planet-*.ts), редкие гости «Космоса» (space-visitor*.ts), blob-pixels.ts
    │   ├── fx/
    │   │   ├── common/             частицы (particles.ts, particle-fx.ts, particle-motion.ts), кривые (anim-curves.ts, ease.ts), текст-всплывашки,
    │   │   │                       spring-back.ts (пружинный твин масштаба), timed-pool.ts, fx-textures.ts, sparkle-fx.ts, plain-style.ts
    │   │   ├── tower/              осколки (debris-fx.ts), обвал, приземление, кольцо «идеально», свечение комбо, искорки у башни, всё вокруг летящего слоя (flying-*.ts)
    │   │   ├── creatures/          частицы материалов (material-fx.ts), картинки роста мастерства
    │   │   ├── glaze/              капли и рост глазури
    │   │   ├── cuts/               срезы (cut-*.ts)
    │   │   ├── toppers/            украшения и их придавливание, кремовый валик
    │   │   ├── zones/              визуал правил зон (rule-fx.ts, rule-state.ts, rush-outline.ts, speed-streaks.ts, cloud-cover.ts), края витков, картинки контрольных точек
    │   │   ├── economy/            монеты и золотой слой (coin-fx.ts, coin-flight-math.ts, golden-fx.ts), выплаты, картинки наград и сокровищ
    │   │   ├── run/                run-fx.ts (замедление промаха `timeScale`), goal-line.ts (линия своего результата, вымпел), record-moment.ts (праздник рекорда: конфетти), вход забега, итоги
    │   │   ├── audio/              звуковые подсказки эффектов (*-cues.ts, cue-sounds.ts)
    │   │   ├── app/                работа кадра для уровня эффектов (frame-work-*.ts)
    │   │   └── abilities/          анимации способностей: в корне общий шаблон и помощники (ability-fx.ts, kit.ts, sprite-*.ts,
    │   │       │               ability-textures.ts, master-fx.ts)
    │   │       ├── signatures/     фирменные: по файлу на существо и реестр signatures.ts
    │   │       ├── rainbow/        Радужка: облако, дуга, полосы, обод, картинки
    │   │       └── while-active/   «пока действует»: шуба летящего слоя, щит, виньетка, направляющие, полёт крошек
    │   ├── debug/              панель отладки, выбор бригады, сцены `?lineup=1` и `?artsheet=1`, проверка неподвижных объектов
    │   │                       `idle-audit.ts` + `still-watch.ts`, заплыв на утечки `soak-driver.ts` + `soak-metrics.ts` (только сборка разработки)
    │   ├── perf/               замер `?perf=1`: `perf-director.ts` (проигрывает отрезки), `perf-session.ts` (состояние замера, настройка забега),
    │   │                       `perf-drivers.ts` (кто роняет слои), `perf-stats.ts` (чистая математика и таблица), `draw-calls.ts`, `run-hooks.ts`
    │   └── ui/
    │       ├── common/         кнопка, текст с обводкой, затемнение, переход, шрифты, `bake-texture.ts` (запекание картинок), `cpu-canvas.ts`
    │       │                   (холст с пикселями в памяти для картинок через `putImageData`), `shared-atlas.ts` (общий атлас мелких картинок,
    │       │                   `_archive/08-tech-journal.md`), `tall-atlas-art.ts` (высокие картинки атласа, от высоких к низким), покачивание `idle-motion.ts`
    │       ├── run/            окно паузы (`pause-overlay.ts`), окно «Продолжить?» (`continue-window.ts`, `continue-timer.ts`,
    │       │                   `continue-buttons.ts`), покачивание HUD (`hud-idle.ts`), раскладка строки HUD
    │       ├── tower/          шкала качки, плашка темпа
    │       ├── creatures/      плашка следующего существа, значки эффектов, подписи мастер-эффектов, рамка мастерства, значки существ
    │       ├── economy/        счётчики монет и ягод (`resource-tally.ts`, `treasure-hud.ts`, `treasure-flights.ts`)
    │       ├── zones/          плашка зоны (`zone-plate.ts`), смена зоны
    │       ├── style/          общий набор интерфейса, из него собираются все экраны и окна (`volume.ts`: панели, карточки, плашки,
    │       │                   полоса, объёмная кнопка; `title-ribbon.ts`: лента заголовка; `dialog-window.ts`: окно с вуалью;
    │       │                   `toggle-switch.ts`: переключатель; `ring-timer.ts`: круговой таймер; `wallet-chip.ts`: счётчик валюты на
    │       │                   плашке; `hud-plate.ts`: полупрозрачная плашка HUD; `menu-scenery.ts`: кухня забега за меню)
    │       └── menu/           куски экранов меню по папкам экранов и окон: home/, collection/, detail/, team/, daily/, shop/,
    │                           results/ (и новый уровень), streak/, missions/, oven/, new-creature/, settings/, checkpoint/,
    │                           consent/ (окно-пояснение перед системным вопросом ATT), cloud/ (окна «Найден прогресс» и «Два сохранения»);
    │                           widgets/: общие элементы (шапка с лентой и кошельком на плашках, кнопки-иконки, звёзды, цена с иконкой,
    │                           полоса опыта, карточка существа, подпись способа получения, `fitText`)
    ├── services/       ВНЕШНИЙ МИР (интерфейс + native + web-заглушка)
    │   ├── storage/            `types.ts` (`StorageService`), `web.ts` (localStorage, при сбое память страницы), `memory.ts`, `native.ts` (`@capacitor/preferences`)
    │   ├── app-shell/          приложение вокруг игры: `types.ts` (`AppShellService`: активность, «назад», свернуть, убрать заставку), `native.ts` (`@capacitor/app`, `@capacitor/splash-screen`), `web.ts` (в браузере ничего)
    │   ├── rewarded-video/     реклама: `types.ts`, `web.ts` (заглушка), `native.ts` (AdMob), `plugin.ts` (события плагина), `ad-units.ts` (идентификаторы блоков по платформе)
    │   ├── iap/                покупки: `types.ts` (`IapService`), `web.ts` (заглушка стора), `native.ts` (RevenueCat), `product-ids.ts` (ключ товара ↔ ид. из `.env`)
    │   ├── telemetry/          аналитика: `types.ts`, `web.ts` (консоль в dev), `native.ts` (Firebase Analytics через плагин, только при файле настроек), `validate.ts` (проверка имён и параметров), `event-log.ts` (журнал для отладочного меню)
    │   ├── crash/              сбои: `types.ts` (`CrashService`), `web.ts`, `native.ts` (Crashlytics), `reporter.ts` (глобальный обработчик, ограничения), `describe.ts` (стек в кадры)
    │   ├── haptics/            `types.ts`, `switchable.ts` (общий выключатель), `web.ts` (`navigator.vibrate`), `native.ts` (`@capacitor/haptics`)
    │   ├── audio/              звук и музыка: `web.ts` (`WebAudioService`), `synth.ts` (кирпичики звуков), `mixer.ts` + `mixer-math.ts` (шины, ограничитель, приглушение), `sound-args.ts` + `sound-book.ts` (реестр звуков `SOUND_BOOK`), `sound-player.ts` + `voice-gate.ts` (допуск звуков: приоритеты, предел, повтор), `node-tally.ts` (счёт живых узлов), `music-control.ts` + `music-proxy.ts` (интерфейс музыки, заглушка и запоминание вызовов), `music/` (плеер готовых треков: `playlist-player.ts` плейлист и исключения, переходы между треками, не больше двух одновременно, `playlist-turn.ts` чистые расчёты хода плейлиста (длина хода трека, позиция, первый и следующий трек), `tune-deck.ts` один трек на своей громкости с петлёй (разобранный буфер или поток через элементы `audio`), `media-pool.ts` элементы `audio` потока, `tune-loop.ts` чистые расчёты петли (границы с учётом добавочных отсчётов AAC, сглаживание стыка) и кривые перехода, `tune-loader.ts` загрузка и разбор файла; раскладка мест и треков в `data/audio/music.ts`, кто что просит в `musicAskFor` там же), `offline-render.ts`, `wav.ts`, `levels.ts` (запись звука без устройства и измерения), `notes.ts`
    │   ├── silent-mode/        беззвучный режим устройства: `types.ts`, `web.ts` (заглушка, никогда не беззвучный)
    │   ├── notifications/      локальные уведомления: `types.ts`, `web.ts`, `native.ts`
    │   ├── consent/            согласия (UMP, ATT): `types.ts`, `web.ts`, `native.ts`
    │   ├── rating/             системное окно оценки: `types.ts` (`RatingService`), `web.ts`, `native.ts`
    │   ├── games/              Game Center: `types.ts` (`GamesService`), `web.ts` (заглушка с режимами `?games=`), `native.ts` (плагин `TippyGames`), `status-hub.ts` (состояние входа и подписчики)
    │   ├── cloud-save/         облачная копия: `types.ts` (`CloudSaveService`), `web.ts` (заглушка на `localStorage` с режимами `?cloud=`), `native.ts` (iCloud «ключ-значение» через плагин `TippyGames`)
    │   ├── share/              `types.ts`, `web.ts` (`navigator.share` или скачивание PNG)
    │   ├── common/             `fire-and-forget.ts` (вызов плагина без ожидания, сбой не доходит до игры)
    │   └── index.ts            выбор реализации по платформе
    ├── state/
    │   ├── events/             события аналитики слоя сохранения (`state-events.ts`) и свойства игрока (`user-properties.ts`)
    │   ├── game-state.ts       единственный владелец сохранения в памяти (класс `GameState`, зависимости внедряются)
    │   ├── save-store.ts       загрузка с таймаутом, отложенная запись, копия и повтор (класс `SaveStore`)
    │   ├── cloud/cloud-adopt.ts  чистые правила принятия облачной копии (`withCloudAdopted`: что остаётся с устройства) и отметки отправленной копии
    │   ├── run/run-draft.ts    черновик забега на время фона: запись, разбор, сверка с сохранением (`makeRunDraft`, `readRunDraft`, `draftMatches`)
    │   ├── run-record.ts       чистые правила конца забега: статистика, рекорд, XP, награды уровней
    │   ├── creatures.ts        чистые правила команды, покупки и улучшения существ
    │   ├── streak.ts           чистые правила серии: вход, календарь, награда (существо через `grantCreature`), восстановление, отказ
    │   ├── missions.ts         чистые правила заданий: список дня, прогресс забега, награда, замена, сундук
    │   ├── daily.ts            чистые правила башни дня: сведения для экрана, попытки, запись забега и выплата ступеней
    │   ├── gift.ts             чистые правила коробки: готовность и открытие с выплатой монет
    │   ├── run-progress.ts     что забег добавляет к серии, заданиям и башне дня (`RunExtras`, `applyRunProgress`)
    │   ├── wallet.ts           чистые правила монет, ягод и счётчика рекламы
    │   ├── hints.ts            подсказки обучения и отладочное переопределение на одну загрузку
    │   ├── index.ts            экземпляр `gameState` игры
    │   ├── page-lifecycle.ts   запись при сворачивании страницы
    │   └── test-state.ts       состояние на памяти для тестов
    ├── i18n/
    │   ├── index.ts
    │   ├── en.json
    │   └── ru.json
    └── util/
        ├── clock.ts            единственный источник времени: `now()` (с `?dayOffset`), `localDay`, `utcDay`, `clockWentBack`
        ├── install-id.ts       `makeInstallId` через `crypto.getRandomValues`
        ├── shelf-packer.ts     раскладка прямоугольников по полкам страницы атласа с возвратом мест (`ShelfPacker`)
```

## 3. Правило зависимостей

```
data  ◄── core ◄── state ◄── game (scenes)
                     ▲           │
                     └── services┘
```

- `core` импортирует только `data` и `util`.
- `state` связывает `core` и `services/storage`.
- `game` импортирует всё, но не содержит правил игры.
- `services` не импортирует `game`.

Это проверяется правилом ESLint `no-restricted-imports` (настроить на этапе M0).

**Страховочная обёртка декораций.** Код декораций (частицы, украшения, подписи мастер-эффектов, слизывание, фон, эффекты способностей) вызывается через единую обёртку `game/common/fx-guard.ts` (в кадре — `fxGuard.call(имя, объект, метод, аргументы…)` без замыкания на вызов, возвращает `false` при сбое, очистка — `fxGuard.cleanup(имя, объект, метод)`; в редких местах — `fxGuard.run(имя, функция, очистка?)`, `fxGuard.value(имя, функция, запасное)`), а ядро (`src/core`, шаг симуляции, подсчёт очков, сохранение) через неё не вызывается: его ошибки должны быть видны. Сбой эффекта пропускает этот эффект на кадр, игра идёт дальше; в сборке разработки в консоль уходит один `console.warn` с именем эффекта на забег (`devWarn`; `GameScene.create` сбрасывает список уже названных). Обёртка стоит в точках вызова, а не внутри файлов эффектов: `RunFx.handleEvents` и `RunFx.update` (по имени на каждый эффект), `RunCamera.apply` (фон), `GameScene.update` (смена зоны фона и `run-bake-step`, запекание картинок результата в полёте), `HudScene.update` (`hud-zone-banner` плашка зоны, `hud-next-idle` покачивание плашки следующего существа, `hud-effect-badges` анимация значков эффектов, `hud-numbers-idle` покачивание чисел, `hud-master-captions` и `hud-captions-update` подписи мастер-эффектов, `hud-tempo-chip` плашка темпа, `hud-treasure` сокровища; без обёртки остаются числа счёта и высоты, шкала качания, значения плашки следующего существа, подсказки обучения, кнопка паузы и окна), слизывание (`LickDirector`, `FaceLick`: с очисткой, которая роняет слизывание). Новый эффект забега подключается к кадру только через обёртку.

**Сторож цикла кадров** (`game/app/loop-watch.ts`, решение — чистый `LoopWatch`, числа — `LOOP_WATCH` в `data/app/loop-watch.ts`). Необработанное исключение в шаге сцены, окончании анимации или отложенном вызове останавливает цикл кадров Phaser насовсем: следующий кадр заказывается только после успешного шага. Сторож стоит на собственном таймере (не в кадре и не в `fxGuard`: его ошибки видны) и раз в `checkMs` сравнивает счётчик кадров `game.loop.frame`. Если страница видна (`document.visibilityState`), игру не усыпляли (`HIDDEN` от Phaser или оболочки приложения, до `VISIBLE`) и счётчик не растёт дольше `stallMs`, цикл перезапускается (`loop.sleep()` и `loop.wake(true)`) и уходит нефатальный отчёт `loop-stall` (`CrashReporter.reportLoopStall`). Ложных срабатываний нет по построению: таймер, который сам опоздал (главный поток был занят: загрузка, запекание), только сдвигает отсчёт; скрытая страница и возврат к видимой тоже начинают отсчёт заново. Предел: не больше `restartsMax` перезапусков за загрузку страницы и не чаще раза в `restartGapMs`; когда предел исчерпан, уходит один отчёт `loop-stall-gave-up` и сторож больше цикл не трогает.


## 4. Симуляция забега (`core/tower/tower-sim.ts`)

Симуляция — машина состояний, которая ничего не знает об экране. Сцена вызывает `update` и `drop`, а в ответ получает **события**, по которым проигрывает анимации.

```ts
export interface RunConfig {
  seed: number;
  mode: 'classic' | 'daily';
  team: Array<{ id: CreatureId; level: number } | null>; // 3 slots
  tutorial: boolean;
  startHeight?: number; // debug: start with N perfect full-width layers already placed
  speedScale?: (c: { index: number; height: number; zoneIndex: number; combo: number }) => number; // analysis only
}

export type SimPhase = 'flying' | 'falling' | 'pause' | 'await_continue' | 'over';

export type LayerKind = 'plain' | 'creature' | 'golden';

export interface LayerPlan {   // what a layer is, decided at spawn (core/creatures/team-queue.ts)
  kind: LayerKind;
  creature?: CreatureId;       // only for kind 'creature'
  level?: number;              // team slot level, clamped to 1..5
}

export interface FlyingLayer extends LayerPlan {
  index: number;               // 1-based number the layer will have in the tower
  x: number;                   // centre
  width: number;
  dir: 1 | -1;
  speed: number;               // nominal px/s: speedCurve(height) × ability mult
  zoneIndex: number;           // index into ZONES (data/zones/zones.ts)
  rule: LayerRuleKind;         // 'none' | 'showcase' | 'roof' | 'clouds' | 'stars'
  rush: boolean;               // rush: holds still for the wind-up, then ×speedMult (Showcase 1.2) or ×spaceSpeedMult (Space 1.35, capped)
  windupMs: number;            // wind-up left, the layer does not move while > 0
  stopMs: number;              // fake-out stop left; the layer reverses when it reaches 0
  coverMs: number;             // cloud cover left, the layer is hidden while > 0
  pass: number;                // 1-based pass across the screen (+1 at every wall bounce)
}
// flyingSpeed(layer) in core/tower/flight.ts is the speed right now: 0 while windupMs or stopMs > 0,
// otherwise rushSpeed(speed) if rush × (rule === 'roof' ? roof profile at x : 1)

export interface PlacedLayer extends LayerPlan {
  x: number;                   // resting centre, wobble not included
  width: number;
  quality: 'perfect' | 'normal';
}

export interface TowerState {
  phase: SimPhase;
  phaseMs: number;             // time spent in the current phase (drives the fall animation)
  height: number;              // layers.length + bonusHeight
  bonusHeight: number;         // extra height that is not a layer (twins count as two)
  score: number;
  coins: number;
  berries: number;
  combo: number;
  bestCombo: number;
  wobble: number;              // 0..100
  wobblePhase: number;         // radians
  layers: PlacedLayer[];       // bottom → top
  flying: FlyingLayer | null;  // x, width, dir, speed, kind
  floatingCoinX: number | null; // centre x of the floating coin at the current layer height
  effects: ActiveEffect[];     // ability effects with remaining layers
  zoneIndex: number;
  continuesUsed: number;
  shield: number;              // remaining layers of Brownie shield, 0 = none
  shieldLevel: number;         // level of the brownie that gave the shield ("Change"), 0 = none
}

export type SimEvent =
  | { type: 'spawn'; layer: FlyingLayer }
  | { type: 'land'; quality: 'perfect' | 'normal'; dx: number; cutWidth: number; savedWidth: number; cutSide: 'left' | 'right' | null; newWidth: number }
  | { type: 'miss'; shielded: boolean }
  | { type: 'combo'; value: number; widened: number }
  | { type: 'wobble_sneeze'; newWidth: number }
  | { type: 'coin_spawn'; x: number }
  | { type: 'coin_collect'; amount: number; source: CoinSource }
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: AbilityPayload }
  | { type: 'mastery'; creature: CreatureId; coins: number; score: number } // a master effect did something
  | { type: 'perk'; creature: CreatureId; perk: PerkId; score: number }     // rainbow score per protected layer
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }   // at the spawn of the first layer of a new zone
  | { type: 'cloud'; coverMs: number; pass: number }   // a cloud starts covering the layer
  | { type: 'fakeout'; x: number; stopMs: number }     // the layer stops, then reverses
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };

export type CoinSource = 'floating' | 'combo' | 'perfect' | 'crumb' | 'golden' | 'height' | 'mastery';

export class TowerSim {
  constructor(config: RunConfig);
  readonly state: Readonly<TowerState>;
  update(dtMs: number): SimEvent[];   // advances flying layer, wobble, timers
  drop(): SimEvent[];                 // player tap
  continueRun(): SimEvent[];          // after ad / berries
  decline(): SimEvent[];              // player refused to continue
  topLayerX(): number;                // current x of top layer incl. wobble
}
```

**`RunConfig.speedScale`** — крючок только для анализа темпа (`npm run sim:speed-variants`), игра его никогда не задаёт. Вызывается один раз при появлении каждого слоя, результат умножает номинальную скорость этого слоя (после зоны, предела и множителя способностей, вместе с замедлением обучения). Без него (или с функцией, всегда возвращающей 1) забег совпадает с обычным до последнего события (тест `tower-sim-speed-scale.test.ts`). Данные из `data/` крючок не меняет.

Итог забега (`core/run/run-result.ts`):

```ts
export interface RunResult {
  seed: number;
  mode: 'classic' | 'daily';
  height: number;
  score: number;
  coins: number;
  berries: number;
  perfects: number;
  bestCombo: number;
  continuesUsed: number;
  zoneIndex: number;
  durationMs: number;          // simulated time, the continue offer excluded
  endReason: 'miss' | 'sneeze' | 'quit'; // 'quit' is set by the scene, not by the simulation
}
```

Уточнения поведения:
- Симуляция создаётся в фазе `pause` с истёкшим таймером: первый же шаг `update` выпускает первый слой и событие `spawn`.
- Результат броска считается в конце падения (через 110 мс после касания) относительно положения верхушки в этот момент. Событие `land` приходит из `update`, а `drop` возвращает пустой список.
- При обычном броске центр оставшейся части смещается на `dx / 2` от центра слоя под ней.
- Событие `land.newWidth` — ширина до расширения за комбо и до чиха; расширение приходит в `combo.widened`, чих в `wobble_sneeze.newWidth`.
- Если чих оставил слой уже 24, слой остаётся в башне и считается в высоту, а забег заканчивается промахом с причиной `sneeze`.
- В фазах `await_continue` и `over` время не идёт: `update` ничего не делает. Таймер окна «Продолжить?» ведёт сцена и по его истечении вызывает `decline()`.
- При продолжении комбо сброшено, качка 0, возвращается слой шириной `max(ширина промахнувшегося, 360)`.
- Кадр длиннее 250 мс обрезается, чтобы свёрнутая вкладка не «проматывала» забег.
- Зона слоя считается по его индексу: `min(5, floor((i − 1) / 20))`. `state.zoneIndex` обновляется при появлении слоя, `zone_change` приходит один раз перед `spawn` первого слоя новой зоны (слои 21, 41, 61, 81, 101); повтор того же индекса (щит, продолжение) событие не повторяет. Отладочный `startHeight` ставит `zoneIndex` сразу по `startHeight + 1`, без события.
- Правила зон выбираются по индексу слоя, а не по ходу игры: `rng.fork('zones')` и под-потоки `fork('layer:<индекс>')` (рывок, обманка, сторона, правило Космоса) и `fork('cloud:<проход>')` внутри него. Поэтому расписание зависит только от зерна и индекса: повтор слоя, пропуск индексов двойняшками и действия игрока ничего не сдвигают. Парящая монета бросается так же, из `coins.fork('layer:<индекс>')`. Чистое API лежит в `core/zones/zones.ts` (`zoneIndexOf`, `layerRules`, `rushIndices`, `cloudRoll`, `nominalSpeed`).
- Движение летящего слоя (стены, профиль «Крыши», ожидание рывка, остановка и разворот обманки, счёт проходов, укрытие облаком) живёт в `core/tower/flight.ts`; `TowerSim` остаётся машиной состояний и вызывает `Flight.step` на каждом шаге. Скорость в данный момент даёт `flyingSpeed(layer)`: 0 во время ожидания рывка и остановки обманки, иначе номинальная `speed`, умноженная на множитель рывка (`rushSpeed`: Витрина ×1,2, Космос ×1,35 не быстрее 1350) и на профиль у «Крыши». Бот и сцена берут скорость только оттуда.
- Множителей скорости у зон нет (с 2026-11-16): номинальная скорость слоя — `layerSpeed(высота, speedMult способностей)` = `speedCurve(высота)` × множитель способностей (`core/tower/speed-curve.ts`), рывок (`rushSpeed`, в Космосе не выше 1350) и профиль Крыши умножают поверх. Множитель очков зоны умножается на `scoreMult` способностей при начислении очков слоя (зона берётся по летящему слою); плоский бонус золотого слоя не умножается.
- Облако не меняет физику: `FlyingLayer.coverMs` и событие `cloud` нужны сцене и боту. Обманка шлёт `fakeout` в начале остановки.

Требования:
- `update` работает с фиксированным шагом 1/120 с (накопитель времени внутри), чтобы поведение не зависело от частоты кадров.
- Вся случайность берётся из `Rng`, созданного из `config.seed`. Отдельные потоки случайности для зон, монет и косметики, чтобы изменение одного не сдвигало другие: `rng.fork('zones')`, `rng.fork('coins')`.
- Косметическая случайность (разлёт частиц) живёт в сценах и может использовать `Math.random()`.
- Симуляция не знает о времени суток, сохранении и рекламе.

### Способности

```ts
// core/abilities/types.ts
export interface AbilityContext {
  creature: CreatureId;
  state: TowerState;        // mutable inside sim
  level: number;            // 1..5
  boosted: boolean;         // perfect drop
  layer: PlacedLayer;       // the creature layer that has just landed
  emit(e: SimEvent): void;
  addEffect(layers: number, value: number): void; // starts or extends the effect of this creature
}

export interface Ability {
  id: CreatureId;
  onLand(ctx: AbilityContext): void;                 // when creature layer lands
  modifiers?(effect: ActiveEffect): Partial<Modifiers>; // while effect is active
  lowerValueIsStronger?: boolean;                    // frosty, crumb: extension keeps the smaller value
  // Mastery hooks (see "Мастерство" below), all optional:
  ownLayer?(level: number): Partial<Modifiers> | null;  // the drop of the creature's own layer
  afterLanding?(effect: ActiveEffect, landing: Landing, ctx: HookContext): void;
  onEnd?(effect: ActiveEffect, ctx: HookContext): ActiveEffect | null; // a tail takes its place
  onMiss?(effect: ActiveEffect, ctx: HookContext): void;
  onCloud?(effect: ActiveEffect, ctx: HookContext): void;
  onShieldSave?(level: number, ctx: HookContext): void;
}

export interface Modifiers {
  speedMult: number;
  scoreMult: number;
  coinMultAdd: number;      // additive, see creatures doc
  perfectTolerance: number; // overrides base when larger
  protectCut: boolean;       // rainbow: the layer is not cut, the drop counts as normal
  guides: boolean;
  centreMark: boolean;       // ghost from level 2: centre mark of the perfect spot (display only)
  guidesMaster: boolean;     // guides of a level-5 ghost: the cloud is see-through (screen and bot)
  springShare: number;       // jelly: share of the offset a normal drop springs back
  crumbToCoinsPx: number | null;
  perfectCoinAdd: number;   // lemon: coins per perfect drop, summed, not multiplied
}
```

Симуляция перед каждым броском собирает итоговые `Modifiers` из активных эффектов. Множители зоны (скорость, очки) в `Modifiers` не входят и применяются отдельно, потому что потолок скорости Космоса действует до множителя способностей (см. раздел 4 и журнал решений `_archive/08-tech-journal.md`). Новая способность добавляется файлом в `abilities/` и строкой в `registry.ts`.

#### Мастерство (этап «Мастерство существ»)

Правила — `03-creatures.md`, раздел «Мастерство»; числа — `src/data/creatures/mastery.ts` (`MASTERY`) и поля способностей в `src/data/creatures/creatures.ts`.

- **Где живут мастер-эффекты.** В модуле своего существа (`abilities/<id>.ts`), а не в `tower-sim.ts`. Интерфейс `Ability` получает необязательные крючки (`abilities/types.ts`), которые симуляция зовёт из одного места (`abilities/run.ts`, функции `runLandingHooks`, `tickRunEffects`, `runMissHooks`, `runCloudHooks`; `abilities/modifiers.ts`, `dropModifiers`):
  - `afterLanding(effect, landing, ctx)` — слой приземлился под эффектом, до отсчёта слоя; `Landing` = `{ quality, pieceWidth, flyingWidth, golden }` (качество броска, откушенный кусок так же, как его считает «Кроха», ширина летящего слоя до среза, золотой ли слой). Здесь «Медовый след», «Золотая жила», «Залп», «Запасливый», «Кураж», очки и «После дождя» «Радужки»;
  - `onEnd(effect, ctx)` — эффект отсчитал последний слой; вернувший эффект встаёт на его место (хвосты «Долгий отскок», «Иней»), `effect_end` тогда не приходит. Хвост хвоста не рождает (проверяет `run.ts`);
  - `onMiss(effect, ctx)` — любой промах (бросок или чих, со щитом и без) при активном эффекте («Кураж» срывается);
  - `onCloud(effect, ctx)` — облако начало закрывать летящий слой («Не страшно»);
  - `onShieldSave(level, ctx)` — щит спас промах, `level` = `shieldLevel` щита («Сдача»); `shieldLevel` лежит в `TowerState` рядом с `shield`, ставится вместе с более длинным щитом и обнуляется, когда щита нет;
  - `ownLayer(level)` — модификаторы броска собственного слоя существа («Радужка» с 3-го уровня: `protectCut`). Эффекты для слоя-существа собираются до его способности, поэтому своя защита идёт не через эффект, а через `dropModifiers(effects, plan)`, которым пользуются и приземление, и `landingPreview`.
  Мастер-эффект проверяет уровень сам (`isMaster(effect.level)` из `core/creatures/mastery.ts`). Счётчики «за срабатывание» лежат в `ActiveEffect` необязательными полями `uses` (продления «Залпа», возврат «После дождя») и `spoiled` («Кураж» сорван) и стираются в `addOrExtendEffect`; хвост помечен полем `tail`, отдаёт свои `modifiers` и при новом срабатывании заменяется новым эффектом целиком. Свойства лестницы «Радужки» (`protectedScore`, `ownLayerFrom`) и метка «Безешки» (`centreMarkFrom`) читаются из определения способности по уровню. Монеты мастер-эффектов платит `payMastery` (`abilities/helpers.ts`) через общий `gainCoins` (`core/economy/run-coins.ts`).
- **`Modifiers`** получает только то, что действует до броска: допуск хвоста «Инея» идёт через `perfectTolerance`, флаги `centreMark` («Безешка» с 2-го уровня, только для экрана) и `guidesMaster` (направляющие 5-го уровня, для экрана и бота) или-ятся, как `guides`. «Медовый след» и «Золотая жила» платят в `afterLanding` (источник `mastery`), а не через `perfectCoinAdd` и не через отдельный множитель золотого слоя: так монеты идут своим источником и событие `mastery` знает существо; множитель «Золотой жилы» — `MASTERY.caramel.goldenCoinMult`. Для экрана `TowerSim.flyingModifiers()` отдаёт модификаторы броска летящего слоя вместе со своей защитой «Радужки» (радужный контур слоя самой «Радужки»), `currentModifiers()` — только эффекты.
- **Событие `mastery`** `{ type: 'mastery'; creature: CreatureId; coins: number; score: number }` приходит каждый раз, когда сработал мастер-эффект (в том числе продление, возврат, начало хвоста, ослабление облака «Безешки»; тогда `coins` и `score` нули). Монеты при этом приходят отдельным `coin_collect` с новым источником `CoinSource` = `'mastery'` сразу после `mastery` (добавка «Золотой жилы» сверх 10 тоже он); очки уже в счёте забега. Сцена по `mastery` показывает подпись мастера; `RunTally` и `npm run sim:coins` считают источник `mastery` отдельной колонкой, экран итогов — отдельной строкой («Мастерство»). Очки «Радужки» за защищённый слой (ур. 2+, не мастер) приходят событием `{ type: 'perk'; creature; perk: 'rainbow_protected_score'; score }`, по нему экран показывает «+B».
- **Бот.** Мастер-эффекты, меняющие высоту («Иней», «Долгий отскок», «Не страшно», «После дождя», своя защита «Радужки»), работают в той же симуляции и попадают в `npm run sim`, `sim:teams`, `sim:strong` сами. «Не страшно»: `Bot` берёт множитель ошибки под облаком `DIFFICULTY.ghostCloudSdMult` вместо `cloudSdMult`, если в текущих `Modifiers` направляющие от эффекта 5-го уровня (поле `guidesMaster`) — допущение модели, как `guidesSdMult`.
- **Без бригады ничего не меняется:** забеги без существ дают тот же вывод `npm run sim`, что и до этапа (побайтно); отличаются только строки бригад с существами на уровнях, где правило изменилось.
- **API ядра для экранов** (`core/creatures/mastery.ts`, чистые функции с тестами рядом):
  - `lookStage(level): 'base' | 'grown'` — ступень вида (`grown` с `MASTERY.lookLevel` = 3); её берут рисование существа и ключ картинки слоя; `hasNewLook(level)` — то же как `boolean`;
  - `isMaster(level): boolean` — 5-й уровень: золотая рамка, строка мастер-эффекта, подписи в забеге;
  - `upgradePreview(id, fromLevel): UpgradePreview | null` — что даст следующий уровень (`null` на максимуме): `{ toLevel, changes: Array<[key, from, to]>, perks: PerkRow[], newLook: boolean, master: CreatureId | null }`, где `changes` — меняющиеся числа текста способности (`abilityChanges` из `core/creatures/ability-values.ts`, ключи — плейсхолдеры `creature.<id>.desc`, пар с равными числами нет), `perks` — свойства лестницы, новые на этом шаге или с новым числом: `PerkRow` = `{ id: PerkId; values: Record<string, number> }`, `PerkId` = `ghost_centre_mark` | `rainbow_protected_score` | `rainbow_own_layer` (`data/creatures/mastery.ts`), строка — `t('mastery.perk.<id>', values)`; `newLook` на шаге к 3-му уровню, `master` на шаге к 5-му. Тест: у каждого из 12 существ на каждом из 4 шагов превью не пустое;
  - `perksAt(id, level): PerkRow[]` — свойства лестницы, которые у существа уже есть (строки под текстом способности);
  - `masterInfo(id): { nameKey, shortKey, values }` — ключи i18n имени и фразы мастер-эффекта (`mastery.<id>.name`, `mastery.<id>.short`) и числа для плейсхолдеров фразы, взятые из `MASTERY` (фраза не расходится с балансом). Общие строки: `mastery.newLook` («Новый вид»), `mastery.master` («Мастер: «{name}»»).
  Экраны сами ничего не решают о мастерстве, только переводят эти ответы в картинки и строки.

## 5. Состояние и сохранение

`state/game-state.ts` — единственное место, где сохранение живёт в памяти и изменяется. Сцены вызывают методы (`gameState.buyCreature(id)`), а не правят объект напрямую. Каждое изменение помечает состояние «грязным»; запись на диск происходит с задержкой 500 мс и обязательно при сворачивании приложения.

```ts
// core/save/schema.ts
// Текущая версия 11. Версия 2: streak.claimedToday заменён на claimedDay, добавлено today.
// Версия 3: в ads добавлен offerDay (день последнего показа предложения «Без рекламы»).
// Версия 4: в ads добавлены shownDay и shownToday (дневной счётчик межстраничной рекламы).
// Версия 5: добавлены oven (счётчик «Свежей печи») и doubles (счётчик «×2 монеты» за день); bakerXp пересчитан под новую кривую.
// Версия 6: форма та же; новая подсказка dailyIntro (окно-объяснение башни дня), миграция убирает её из hintsShown, чтобы окно увидели все.
// Версия 8: добавлен bestLap (лучший достигнутый виток «Космоса», награда за новые витки); миграция 7 → 8 выводит его из рекорда Классики по замороженным числам (`frozen-v8.ts`), чтобы ничего не платилось задним числом.
// Версия 7: добавлены checkpoints (открытые контрольные точки) и checkpointAds (старты за рекламу за местный день); миграция 6 → 7 открывает точки по рекорду.
// Версия 9: в shop добавлен starterPackShownAt (первый показ кнопки стартового набора на Home, начало 7-дневного окна; 0 — ещё не показывали); миграция 8 → 9 ставит момент миграции, если набор не куплен и завершено ≥ 10 забегов (порог заморожен в `frozen-v9.ts`).
// Версия 10 (этап M8): добавлены iap.processedTx (последние 50 оплаченных транзакций стора, защита от двойной выдачи), review (последняя системная просьба об оценке: версия игры и момент; число местных дней игры и последний из них) и notif.giftDay (местный день последнего пришедшего уведомления «Подарок готов»: записывается при следующем открытии, если его момент прошёл, `04-meta-retention.md`, раздел 7); миграция 9 → 10 заполняет их пустыми. Сброс прогресса их сохраняет.
// Версия 11 (выпуск 1.1, все новые поля выпуска разом): stats.flies (прихлопнутые мушки), records.dailyBest (лучшая высота башни дня за всё время),
// prevDay (лучшая высота Классики за день игры перед today.day), sync (облачная копия: номер, id, «менялся ли прогресс после неё»); миграция 10 → 11:
// flies = 0, dailyBest = daily.best, prevDay пустой, sync = { 0, '', true }.
export interface SaveV11 {
  version: 11;
  installId: string;             // random uuid, for mission seed & support
  createdAt: number;             // epoch ms
  lastSeenAt: number;
  coins: number;
  berries: number;
  bakerLevel: number;
  bakerXp: number;
  creatures: Partial<Record<CreatureId, { level: number }>>;
  team: [CreatureId | null, CreatureId | null, CreatureId | null];
  records: { classicHeight: number; classicScore: number; bestCombo: number; dailyBest: number };   // dailyBest: лучшая высота башни дня за всё время
  stats: { runs: number; totalLayers: number; perfects: number; adsWatched: number; flies: number };   // flies: прихлопнутые мушки, копятся с версии 11
  streak: { count: number; best: number; lastDay: string; cycle: number; claimedDay: string };
  today: { day: string; bestHeight: number };   // лучшая высота Классики за местный день
  prevDay: { day: string; bestHeight: number }; // то же за день игры перед today.day; '' и 0 — нет
  missions: { day: string; items: MissionProgress[]; rerollUsed: boolean; chestClaimed: boolean };
  daily: { day: string; attemptsUsed: number; extraAttemptUsed: boolean; best: number; claimedTiers: number[] };
  gift: { nextAt: number };
  shop: { freeCoinsDay: string; freeCoinsUsed: number; starterPackUntil: number; starterPackShownAt: number };   // starterPackShownAt: epoch ms первого показа набора на Home, 0 — не показывали
  purchases: { removeAds: boolean; starterPack: boolean };
  tutorial: { firstRunDone: boolean; hintsShown: string[] };
  settings: { music: boolean; sfx: boolean; haptics: boolean; reducedFx: 'auto' | 'on' | 'off'; lang: 'en' | 'ru' | 'auto';
              notifications: { gift: boolean; streak: boolean; daily: boolean; comeback: boolean } };
  ads: { lastInterstitialAt: number; runsSinceInterstitial: number; sessions: number; offerDay: string; shownDay: string; shownToday: number };   // дни: местные или ''
  oven: { day: string; used: number; carry: number };      // used: «свежих» слоёв потрачено в день day; carry: остаток слоёв (< 6) до следующего опыта, не сбрасывается
  doubles: { day: string; used: number };                  // «×2 монеты» за рекламу, использовано в день day
  checkpoints: number[];                                   // открытые контрольные точки (20/40/60/80/100), по возрастанию; всегда не меньше точек рекорда
  checkpointAds: { day: string; used: number };            // старты с контрольной точки за рекламу, использовано в местный день day
  bestLap: number;                                         // лучший достигнутый виток «Космоса» (0 ниже 101-го слоя); награда за новые витки
  consent: { attAsked: boolean; notifAsked: boolean };
  iap: { processedTx: string[] };                          // ид. транзакций стора, уже выданных игроку, новые в конце, не больше IAP_RULES.processedTxKeep (50)
  review: { askedVersion: string; askedAt: number; playDays: number; lastPlayDay: string };   // просьба об оценке: версия и epoch ms последней ('' и 0 — не просили); местных дней игры и последний из них
  notif: { giftDay: string };                              // местный день последнего пришедшего уведомления «Подарок готов», '' — не было
  sync: { cloudRev: number; cloudId: string; dirty: boolean };   // облачная копия, которую это устройство последним отправило или приняло (0 и '' — ни разу); dirty: прогресс менялся после неё
}

interface MissionProgress { id: string; group: 'easy' | 'medium' | 'hard'; target: number; progress: number; claimed: boolean }
```

`hintsShown` хранит id подсказок: `tutorial` (вступление «Медка» сыграло), `tap`, `firstPerfect`, `honey`, `wobble`, `berry`, `firstResults`, `cloud`, `oven` (окно «Свежая печь»), `dailyIntro` (окно-объяснение башни дня, с версии 6). `checkpoints`: забег Классики, дошедший до высоты, открывает все точки не выше неё навсегда (`withReached`, по полной высоте, а не по поставленным слоям; башня дня не открывает); при загрузке неверные высоты отбрасываются, список сортируется и дополняется точками рекорда. Платит за старт `gameState.payCheckpoint` (ягоды или засчитанный старт за рекламу, сам показ рекламы за вызывающим кодом, `game/run/checkpoint-start.ts`). `reducedFx`: `auto` (игрок не выбирал, решают система и автоматическое переключение), `on`, `off` (выбор игрока важнее системного «Уменьшения движения» и автомата).

Правила:
- Даты дней хранятся строкой `YYYY-MM-DD`: местная для серии и заданий, UTC для башни дня.
- При загрузке: разбор JSON → проверка версии → цепочка миграций → нормализация (недостающие поля берутся из значений по умолчанию). Порядок источников: `save` → `save_backup` → новое сохранение. Текст, который не удалось прочитать, сохраняется под ключом `save_corrupt_<время>`. Сохранение более новой версии считается непригодным и тоже остаётся как `save_corrupt_*`. Загрузка никогда не бросает исключение и не блокирует запуск при сбое хранилища. Если `save` текущей версии разобрался, но в нём нет или неверного типа ключевых полей (`coins`, `berries`, `bakerLevel`, `bakerXp`, `creatures`, `records`, `stats`), он считается повреждённым: при целой копии `save_backup` берётся копия, а поломанный `save` остаётся как `save_corrupt_*`; без целой копии `save` чинится поле за полем, как раньше. Если непригодны оба текста, под ключами сохраняются оба: `save_corrupt_<время>` и `save_corrupt_<время>_backup`.
- Ожидание загрузки ограничено: `gameState.load({ timeoutMs })` (`main.ts` передаёт `BOOT.saveWaitMs`, 2 с) возвращает `{ status: 'loaded', source, ... }`, `{ status: 'timeout' }` или `{ status: 'read_failed' }`. `read_failed` значит, что `storage.get` бросил исключение или отклонён (это не то же самое, что «ключа нет»: пустой ключ даёт новое сохранение). При `timeout` и `read_failed` игра идёт на новом сохранении в памяти, и в хранилище в эту загрузку страницы ничего не пишется (`flush` и отложенная запись отключены), иначе незаконченное чтение могло бы затереть настоящее сохранение. Поздний результат чтения (и запись `save_corrupt_*`) отбрасывается, состояние посреди игры не подменяется, в консоль выводится предупреждение. Прогресс такой сессии не сохраняется.
- Нормализация: числа целые и неотрицательные; уровни существ 1..5; команда состоит из существ, которыми игрок владеет (иначе `null`), без повторов; неизвестные существа отбрасываются; дни `YYYY-MM-DD` или пустая строка; стартовые существа (`SAVE_DEFAULTS.startCreatures`) всегда во владении, а пустая команда получает первое из них в слот 0; `bakerLevel` не выше `MAX_BAKER_LEVEL`, `bakerXp` меньше порога следующего уровня (иначе подделанное число зависило бы первый же забег на миллионах повышений).
- Хранится две копии: `save` и `save_backup` (предыдущая успешная запись). Запись: через 500 мс после первого изменения серии (`SAVE_WRITE_DEBOUNCE_MS`), сразу при `visibilitychange: hidden` и `pagehide`. Если запись не удалась, состояние остаётся «грязным» и повтор назначается не раньше чем через `SAVE_RETRY_MS` (5 с). `lastSeenAt` и проверка «часы переведены назад» идут по настоящим системным часам (`realNow`), а не по часам со сдвигом `?dayOffset=`, иначе после dev-запуска со сдвигом обычный запуск считал бы часы отставшими.
- **Поля версии 11.** `records.dailyBest` растёт при записи забега башни дня, который засчитан (`max` с `daily.best` после записи, `state/run-progress.ts`). `stats.flies` растёт на число мушек забега: мушка прихлопывается в отрисовке (`TowerGuest`, на всех уровнях эффектов), поэтому счёт идёт в сохранение через `RunExtras.flies`, как `abilities`. `prevDay`: `today` сменяется только при записи забега Классики, поэтому во время первого забега нового дня в `today` ещё лежит прошлый день. Когда записывается забег Классики в день позже `today.day`, прежний `today` уходит в `prevDay`; забег в день раньше `today.day` (часы переведены назад) не меняет ни `today`, ни `prevDay`, чтобы лучшие результаты настоящих дней не потерялись (`withDayBest`, `core/progression/prev-day.ts`). Читает лучший результат прошлого дня игры чистая функция `previousDayBest(save, localToday)` там же: если `today.day` раньше `localToday`, прошлый день — это `today`, иначе `prevDay`. Нормализация: отсутствующий `records.dailyBest` берётся из `daily.best`; `prevDay` с неверным днём становится `{ '', 0 }`; `sync` с отсутствующим или неверного типа полем целиком становится `{ 0, '', true }`.
- **`sync.dirty`** ставят только методы `GameState`, меняющие прогресс (`withProgressChanged`, `core/save/sync.ts`): запись забега, оплата старта с точки, награда, восстановление и отказ от серии, задания (награда, замена, сундук), попытки башни дня, подарок, бригада, покупка и прокачка существ, начисление, трата и обмен валют, выдача покупок, восстановление стартового набора, которое вернуло существо, бесплатные монеты, показ стартового набора, отладочные выдачи уровня, забегов и существ, сброс. Не ставят: начало сессии, отметки межстраничной рекламы и предложения «Без рекламы», день игры, просьба об оценке, смена дня, счётчик просмотренной рекламы, согласия, день уведомления о подарке, подсказки обучения, восстановление владения покупками («Без рекламы», признак стартового набора), настройки, обновление `lastSeenAt` и чтение. Причина: сохранение меняется при каждом запуске, и общий флаг был бы взведён всегда. Владение покупками приходит из стора на каждом устройстве само (сверка покупок при запуске), поэтому его возврат не прогресс: иначе второе устройство после покупки «Без рекламы» на первом получало бы окно «Два сохранения» вместо молчаливого принятия облака. Тест `state/sync-dirty.test.ts` перечисляет все методы и свойства `GameState` и относит каждый к одной из двух групп, поэтому новый метод обязан выбрать.
- **Сброс прогресса** (`withProgressReset`) обнуляет `stats`, `records`, `prevDay` вместе с остальным прогрессом; `sync.cloudRev` и `sync.cloudId` остаются, `sync.dirty` = `true`, иначе следующий запуск предложил бы восстановить только что стёртое.

### Облачная копия (iOS, iCloud)

Сервис `services/cloud-save/` (`09-services-analytics.md`, раздел 14) хранит одну копию сохранения в iCloud «ключ-значение» под ключом `CLOUD.keys.copy` (`data/app/cloud.ts`). Связь копии с сохранением — `game/cloud/cloud-sync.ts` (`CloudSync`), решения — чистые функции `core/save/cloud-merge.ts`. Главное правило: местное сохранение не заменяется без явного выбора игрока или без условия «здесь нет изменений после последней синхронизации»; при любом сомнении (ошибка чтения, неразобранный текст, тайм-аут) облако не трогается и игра идёт на местном сохранении.

**Текст копии:** `{ rev, id, lineage, writer, savedAt, save }`. `rev` — номер записи, новая получает `max(cloud.rev, sync.cloudRev) + 1`; `id` — случайный, новый при каждой записи (двое без сети могут записать одинаковый `rev`, и хранилище оставит последнюю запись); `lineage` — id записей, из которых выросла эта, последние `CLOUD.lineageKeep` (200): при записи поверх копии в него добавляются её `lineage` и `id` и прежний `sync.cloudId` устройства; `writer` — `installId` записавшего; `savedAt` — момент записи; `save` — сохранение целиком. Разбор (`readCloudText`): пусто; копия (сохранение старой версии проходит цепочку миграций и нормализацию); копия более новой версии игры; непригодна (не JSON, нет полей или неверного типа, у сохранения нет ключевых полей). Непригодная копия не принимается и не перезаписывается.

**Решение** `decide(local, cloud)`, строки сверху вниз:

| Случай | Условие | Действие |
|---|---|---|
| Облако из более новой версии игры | `cloud.save.version` > `SAVE_VERSION` | не принимать, в облако не писать до обновления; в настройках «Обновите игру, чтобы синхронизировать» |
| Облако из более старой версии | меньше `SAVE_VERSION` | копия проходит миграции, дальше по таблице |
| Облако пусто, устройство уже синхронизировалось | копии нет, `sync.cloudRev` > 0 | отправить местное |
| Облако пусто, устройство ни разу не синхронизировалось | копии нет, `sync.cloudRev` = 0 | ждать (первая запись), затем отправить местное |
| Та же копия | `cloud.id` = `sync.cloudId` | `sync.dirty` — отправить местное, иначе ничего |
| Облако выросло из нашей копии, здесь без изменений | `sync.cloudId` есть в `cloud.lineage`, `sync.dirty` = `false` | принять облако молча |
| Облако ушло далеко вперёд, здесь без изменений | `sync.dirty` = `false`, `sync.cloudId` не пуст, `cloud.rev` − `sync.cloudRev` > `CLOUD.lineageKeep` / 2, `lineage` копии обрезан (длина не меньше `CLOUD.lineageKeep`): нашей копии в нём уже не найти. Разрыв номеров нужен потому, что одна запись добавляет в `lineage` не больше двух id, а к `rev` не меньше единицы: копия, выросшая из нашей, держит наш id ещё `lineageKeep` / 2 записей, а полный `lineage` после `lineageKeep` записей за всё время есть у каждой копии; ближе по номеру и без нашего id — другая ветка, это окно | принять облако молча, местное сохранение перед этим кладётся под `save_replaced_<время>` |
| Здесь почти пусто | `sync.cloudRev` = 0, уровень пекаря 1, `stats.runs` ≤ `CLOUD.almostEmptyRuns` (3), оплаченных на этом устройстве транзакций нет (`iap.processedTx` пуст; «Без рекламы» и стартовый набор, вернувшиеся из стора, не считаются) | окно «Найден прогресс» (`07-ui-screens.md`, раздел 2.4) |
| Всё остальное | изменения с обеих сторон, копия из другой ветки, `rev` меньше нашего, смена учётной записи iCloud | окно «Два сохранения»: игрок выбирает одно |

Автоматического слияния по полям нет: берётся одно сохранение целиком.

**Когда.** Облако не трогается вовсе, если местная загрузка дала `timeout` или `read_failed`, при отладочной подмене, которая пишет в сохранение (`overridesSave`), после отладочной записи (`gameState.debugTouched`) и в `?perf=1`. Чтение — после загрузки местного сохранения, не задерживая запуск (у первого чтения свой тайм-аут `CLOUD.readTimeoutMs`, 3 с), по уведомлению хранилища об изменении с другого устройства и при возврате приложения из фона. Отправка решается сама; «принять молча», «Найден прогресс» и «Два сохранения» ждут входа на Home: копия запоминается, а решение принимается заново по текущему сохранению при входе (`game/cloud/cloud-ask.ts`, первым в `HOME_ASKS`). До ответа игрока в облако ничего не пишется. Запись: после записи забега, после покупки или выдачи товара, при уходе в фон и после сброса прогресса, не чаще `CLOUD.writeIntervalMs` (60 с; повод внутри интервала откладывает запись до его конца). Уход в фон и сброс пишут сразу, без ожидания интервала: в фоне таймеры страницы стоят. Вызов хранилища, который не ответил за `CLOUD.readTimeoutMs`, считается неудачным, и очередь облака идёт дальше; запись, ответившая поздно, проверяется чтением: если в облаке уже лежит наша копия, она считается отправленной. Перед каждой записью облако читается ещё раз и решение принимается заново; пишется, только если оно «отправить местное» (или игрок выбрал местное).

**Первая запись.** Сразу после установки хранилище iCloud ещё пусто: данные с серверов приходят позже (Apple советует откладывать запись). Устройство, которое ни разу не синхронизировалось, при пустом облаке не пишет, пока не пришло первое уведомление хранилища об изменении или пока с `createdAt` не прошло `CLOUD.firstWriteWaitMs` (10 мин; сохранение, созданное «в будущем» при переведённых часах, считается от запуска облака в этот запуск); перед записью облако читается ещё раз. У игроков, обновившихся с 1.0, сохранение старое, и первая запись идёт сразу.

**Запись поверх чужой копии** (`writer` другой или это не та копия, которую устройство знало последней, `sync.cloudId`: так ловятся и два телефона с одним `installId` после восстановления из резервной копии): прежний текст копии перекладывается во второй ключ `CLOUD.keys.previous` тем же вызовом. Игра его не читает; это страховка, по которой прогресс можно вернуть вручную. После удачной записи `sync` = `{ rev, id, dirty }`, где `dirty` остаётся `true`, если прогресс менялся, пока шла запись (счётчик изменений прогресса `GameState`).

**Выбор игрока.** «Восстановить» и «Оставить» у колонки iCloud принимают копию; «Начать заново» (после второго подтверждения) и «Оставить» у колонки устройства пишут местное поверх облака, но только если в облаке всё ещё та копия, что была в окне (или пусто): копия, пришедшая с другого устройства, пока окно стояло, не затирается, и при следующем входе на Home окно выходит снова по ней. Проигравшее сохранение сначала кладётся на устройство под ключом `save_replaced_<время>` (как `save_corrupt_*`); если положить не удалось, ничего не заменяется. Молчаливое принятие проверяется ещё раз перед самой подменой: если прогресс здесь успел измениться, копия не принимается и Home спрашивает заново. Молчаливое принятие копии с обрезанным `lineage` тоже сначала кладёт местное сохранение под `save_replaced_<время>`: родство копий тут не проверить; если положить не удалось, копия не принимается.

**Принятие копии** — `gameState.adopt(copy)` (`state/cloud/cloud-adopt.ts`, `withCloudAdopted`): сохранение заменяется копией, Home строится заново. С устройства остаются `installId` (зерно заданий и подарка, письмо в поддержку), `lastSeenAt` (иначе часы другого устройства включили бы защиту от перевода часов), `consent`, `ads`, `notif`, `review`, `settings`; «Без рекламы» этого устройства остаётся включённым (владение, вернувшееся из стора, не делает сохранение изменённым и само в копию не уходит, а без сети сверка покупок после принятия не прошла бы), стартовый набор берётся из копии (его признак с устройства не дал бы сверке вернуть существо, которого в копии нет). `sync` = `{ cloud.rev, cloud.id, false }`. `iap.processedTx` берётся из копии, и сразу идёт сверка покупок (`syncPurchases`): она выдаёт заново расходуемые покупки этого устройства, которых нет в принятой копии (не старше `createdAt` копии и `IAP_RULES.launchPayoutDays`). Объединять списки нельзя: покупка осталась бы отмеченной как выданная, а её ягоды пропали бы.

**Сброс прогресса** пишет сброшенное сохранение в облако следующей записью (сразу после сброса, без ожидания интервала): `sync.cloudId` остаётся, `dirty` = `true`, решение — «отправить местное».

**Известные ограничения:**
- Между iPhone и Android прогресс не переносится.
- Игра на двух устройствах одновременно без сети даёт окно «Два сохранения»; расходуемые покупки проигравшего сохранения не переносятся (кроме покупок этого устройства, которые заново выдаёт сверка покупок при принятии копии).
- Игрок без iCloud играет как раньше, только с местным сохранением.
- Если учётная запись iCloud не совпадает с учётной записью App Store, «Без рекламы», выданное покупкой на другом устройстве, может перейти вместе с сохранением: восстановление покупок только добавляет. Редкий случай, принят.
- Если первая синхронизация iCloud после переустановки не пришла за срок ожидания, новое сохранение может лечь поверх облачного. Во второй ключ прежняя копия в этом случае не попадает: когда шла запись, облако на устройстве было пусто.
- Если копия в облаке ушла от последней синхронизации этого устройства больше чем на `CLOUD.lineageKeep` / 2 номеров, родство копий не проверить: устройство без своих изменений принимает её молча, даже если она из другой ветки (например, два устройства долго играли без сети); его прежнее сохранение остаётся под `save_replaced_<время>`.
- Если приложение закрылось между записью в облако и записью `sync`, следующий запуск видит свою же копию как чужую ветку и показывает окно «Два сохранения».
- Непригодная копия в облаке (её мог оставить только сбой) блокирует запись с этого устройства, пока её не заменит другое устройство; игра идёт на местном сохранении, в настройках «iCloud недоступен».
- Валюты никогда не уходят в минус: `core/economy/economy.ts` `spend` возвращает новый кошелёк или `null` (отрицательная и нечисловая цена отклоняются, дробная округляется вверх; `earn` берёт только целые неотрицательные суммы); `gameState.spend/spendBerries` возвращают `false`. Покупки и прокачка возвращают `{ ok: true, value } | { ok: false, reason }` (тип `EconomyResult`).
- Монеты забега попадают в сохранение, когда забег кончился (при любом исходе, `gameState.recordRun`); ягоды сразу, как только заработаны (`addBerries`), поэтому `recordRun` их не прибавляет. Если игрок уходит из идущего забега (кнопка «Заново» в паузе, перезапуск из панели отладки, любой другой выход со сцены забега), сцена закрывает забег сама: `TowerSim.quitResult()` собирает `RunResult` с `endReason: 'quit'` из текущего состояния (забег не меняется), `game/run/run-recorder.ts` (`RunRecorder`) записывает его через `recordRun` ровно один раз. Закрытие или перезагрузка страницы посреди забега (`pagehide`) тоже считается выходом из него: сцена забега подписывается в `create` (`state/page-lifecycle.ts`, `bindPageLeave`), записывает забег через `RunRecorder` и сразу сбрасывает сохранение на диск, отписывается на `SHUTDOWN`. Уход в фон (`visibilitychange: hidden`, на телефоне — приложение стало неактивным) выходом не считается, это пауза, но система может выгрузить приложение в фоне без `pagehide`. Поэтому при уходе в фон сцена кладёт **черновик забега** рядом с сохранением, отдельным ключом `run_draft` (`state/run-draft.ts`; форма сохранения не меняется): `RunResult` выхода (`quitResult`, как при `pagehide`), `RunExtras`, стартовая высота, день попытки башни дня, а для сверки — `installId`, `createdAt` и `stats.runs` сохранения на момент записи. Пустой забег (`isEmptyRun`) черновика не даёт, а прежний черновик убирает. При возврате в живое приложение черновик удаляется, и забег идёт дальше; запись забега любым путём (конец, выход, `pagehide`) тоже удаляет черновик, сначала сбросив сохранение на диск. При запуске, после удачной загрузки и до облака, черновик читается (`gameState.recoverRunDraft`): если `installId`, `createdAt` и `stats.runs` совпадают с сохранением, забег записывается как выход (`recordRun`: монеты, опыт, рекорд, задания; ягоды и оплата продолжения уже в сохранении), иначе (забег уже записан, сохранение сброшено или принято из облака, текст не разобрался) черновик молча отбрасывается. Экрана итогов у такого забега нет. При `timeout` и `read_failed` местной загрузки черновик не читается и не пишется. Запись в облако при уходе в фон идёт после черновика и черновика не содержит: забег попадёт в облако следующей записью после восстановления. Если после такого `pagehide` страница вернулась из кэша «назад/вперёд» (`pageshow` с `persisted`), старый забег уже записан, поэтому сцена начинает новый (`launchRun`): монеты не считаются дважды и не теряются. Забег, который уже кончился и записан, повторно не записывается. Бонус за высоту (`payHeightBonus`) платится только когда забег заканчивается сам, у `quit` его нет. Забег, в котором ничего не заработано (высота не выше стартовой, ноль очков, монет и ягод), забегом не считается (`isEmptyRun`): сохранять нечего, а счётчик забегов не должен расти от повторных «Заново». Первый забег игрока за всё время рекордом не бывает, дальше сравнение с сохранённым лучшим результатом.
- Отладочные подмены (`?tutorial=`, `?team=`, `?dayOffset=`) действуют до перезагрузки страницы и не сохраняются. Забеги с `?bot=` и `?start=` искусственные и в сохранение не пишутся вообще (ни монеты, ни ягоды, ни XP: `RunRecorder` выключен, решает `savesRun` в `util/debug-params.ts`); забеги с `?team=` и `?level=` пишутся как обычные, чтобы владелец проверял существ по-настоящему.
- Покупки `removeAds` и `starterPack` при запуске сверяются со стором (`services.iap.ownedNonConsumables()`, источник истины — стор; в браузере его изображает заглушка); после сверки вызывается `services.ads.setRemoveAds`. Поле `iap.processedTx` ведёт `gameState.grantProduct(key, transactionId)` (транзакция уже в списке — не выдаём; выдача и запись одним сохранением), а на запуске `syncPurchases` выдаёт завершённые, но не выданные расходуемые транзакции стора, не старше `createdAt` (`core/economy/purchase-tx.ts`, `gameState.unpaidTransactions`). Срок стартового набора (с версии 9) считается от первого показа кнопки на Home (`shop.starterPackShownAt`, ставит `gameState.noteStarterPackShown`, когда кнопка появилась; `shop.starterPackUntil` > 0 перекрывает конец окна), лимит бесплатных монет хранится в `shop.freeCoinsDay` / `freeCoinsUsed`. Миграциям передаётся время загрузки (`migrate(raw, nowMs)`, шаг цепочки `(raw, nowMs) => raw`): оно нужно шагу 8 → 9.

## 6. Масштабирование экрана

- Логическая ширина всегда **1080**. Логическая высота вычисляется по пропорциям экрана: `1080 × (высота / ширина)`, с ограничением от 1920 до 2520.
- Режим масштабирования Phaser: подгонка по ширине с изменяемой высотой. Перерасчёт при изменении размера окна.
- Игровое поле привязано к низу (поднос на фиксированном расстоянии от нижней безопасной зоны). Интерфейс привязан к верхней и нижней безопасным зонам.
- Экраны забега (`hud-scene`, `results-scene`) раскладываются в безопасной полосе: камера сцены сдвинута вверх на верхний отступ (`setScroll(0, -top)`), поэтому y = 0 в их координатах — верхний край безопасной зоны, а высота раскладки — `bandHeight` (высота холста минус оба отступа). Затемнения и окна на весь холст (`PopupWindow`, подложка результатов) закрепляются за холстом через `buildPinned`/`pinSince` (`game/ui/run/pin-canvas.ts`, scrollFactor 0). Мир (подложка, поднос, башня) живёт в координатах холста: `run/camera-layout.ts` читает `safeBand()`: поднос стоит на `trayBottomOffset` над нижним краем безопасной зоны, а плашки HUD для фоновых картинок сдвинуты на верхний отступ (`hudPlates`, `hudBadgeRowBottomY`). Места из мира в HUD (подсказки обучения, полёт монет) переводятся вычитанием верхнего отступа.
- Отступы безопасных зон читаются из CSS-переменных `env(safe-area-inset-*)` и переводятся в логические пиксели (`game/app/safe-area.ts`, `readSafeInsets`). Холст занимает весь экран вместе с системными панелями; логический размер (`util/logical-size.ts`, `computeLogicalSize`) несёт безопасную полосу: `safeTop` и `safeBottom` — логические пиксели под «островом» или строкой состояния и под полоской жестов. Ограничение высоты 1920–2520 относится к полосе между ними: если полоса короче 1920, холст выше пропорций экрана и вписывается с узкими полями по бокам, как короткий экран без отступов. Сцены читают полосу через `safeBand()` при раскладке (раскладка повторяется по событию `resize`, оно приходит и при смене полосы без смены размера). Интерфейс держится внутри полосы, фоны доходят до краёв холста. В браузере полоса нулевая; параметр `?safe=верх,низ` (CSS px, только сервер разработки и внутренняя сборка) подставляет отступы телефона, например `?safe=59,34` — iPhone 14 Pro Max.
- Меню держат интерфейс внутри безопасной полосы холста (`safeBand()` в `game/app/safe-area.ts`), а фоны тянутся до краёв. Сцены берут рамку через `safeFrame(высота холста)` из `ui/common/safe-frame.ts` (верх, низ, высота рамки; без отступов это весь холст): верхние элементы сдвигаются на `frame.top`, нижние стоят от `frame.bottom`, раскладки, рассчитанные на высоту экрана, получают `frame.height`. Окна (`PopupWindow`) центрируются в рамке и вписываются в неё, уведомление (`showToast`) стоит над нижней полосой. Нижняя панель Home и полоса шапки магазина продолжаются под полосой до края холста (`RefitPlate`: плашка пересобирается, когда меняется её высота); список магазина останавливается у нижней полосы, а `BottomCover` закрывает то, что бежит под ней. Сцены перекладываются по `RESIZE`, который приходит и при смене полосы.
- Плотность рендера: в Phaser 4.2 нет настройки `resolution`, поэтому без ограничения подложка холста равна логическому размеру (1080 × высота) независимо от `devicePixelRatio`: на iPhone 14 Pro Max (430×932 CSS) это 1080×2341, около 2,5 пикселя на CSS-пиксель, на экране 390×844 около 2,77. Игра ограничивает плотность сама (`capRenderDensity` в `game/app/render-density.ts`, вызывается в `main.ts` после `new Phaser.Game`, а ставится, когда рендерер загрузился: по `Phaser.Core.Events.READY`, чтобы подложка не уменьшилась раньше, чем рендерер прочитал её размер): подложка холста уменьшается до `ширина CSS × min(devicePixelRatio, предел)` (не больше логического размера; устройство с плотностью ниже предела не меняется), а размер игры, камеры, ввод и текстуры остаются логическими; вызовы `viewport` и `scissor` контекста WebGL масштабируются, пока привязан кадровый буфер холста. Предел зависит от уровня эффектов и лежит в `RENDER_DENSITY.capByLevel` (`data/app/screen.ts`): полный 2, облегчённый 1,75, минимальный 1,5; функция `densityCapForLevel` (`util/density-scale.ts`). Когда автоматика меняет уровень, предел переприменяется на лету без перезагрузки (проверка раз в кадр в `PRE_RENDER`, до отрисовки: смена размера подложки очищает её). В замере `?perf=1&dpr=` задаёт предел вручную и отключает привязку к уровню, чтобы сравнивать варианты.

## 7. Сцены

- `game-scene` и `hud-scene` работают параллельно: забег и его интерфейс.
- Отдельной сцены для окон нет. Окна меню (задания, серия, настройки, подарок, подтверждения) — `PopupWindow` (`ui/style/dialog-window.ts`) внутри сцены своего экрана: вуаль окна закрывает всё под ним от касаний. Окна забега (пауза, «Продолжить?») стоят в `hud-scene` (`ui/run/pause-overlay.ts`, `ui/run/continue-window.ts`).
- Переходы между экранами идут через единый помощник `ui/common/transition.ts`, чтобы анимация переходов была одинаковой.
- Сцена забега в каждом кадре: `events = sim.update(dt)` → передать события в `TowerView` и `fx` → обновить камеру. По касанию: `events = sim.drop()`.
- Объекты слоёв, частиц и всплывающих текстов берутся из пулов.

**Загрузочный экран.** До загрузки модулей игры на странице стоит загрузочный экран (вид и поведение — `07-ui-screens.md`, раздел 1; рисунок — `06-art-animation-audio.md`, раздел 6). Разметка и CSS лежат прямо в `index.html` (элемент `#boot`, без библиотек и картинок, только CSS-фигуры и SVG-символы); там же объявлены начертания Nunito и стоят `<link rel="preload">` на латиницу и кириллицу. Логика — чистый модуль без импортов `util/boot/boot-screen.ts` (тесты рядом): плагин `boot-screen` в `vite.config.ts` (помощники `scripts/boot-screen-html.ts`, тесты рядом) снимает с него типы, убирает слова `export`, сжимает и вставляет в `index.html` обычным встроенным скриптом вместе с числами `BOOT_SCREEN` (`data/app/boot-screen.ts`) и `APP_SHELL.splashMaxMs`; фразы под рисунком на обоих языках он берёт из `i18n/ru.json` и `en.json` (ключи `boot.tower.*`, `boot.oven.*`), а в сборке ещё и сжимает разметку экрана. Скрипт выполняется до модулей: читает запись `tippy.boot` из `localStorage` (число холодных запусков, язык и «Меньше эффектов» из сохранения), выбирает рисунок (`variantOfLaunch`: чётный запуск — башенка, нечётный — печь), сразу записывает счётчик +1, ставит язык и статичный кадр, через два кадра после первой отрисовки снимает системную заставку через мост Capacitor (`Capacitor.nativePromise('SplashScreen', 'hide')`) и оставляет на `window.__tippyBoot` ручку `done()`. Игра зовёт её после первого кадра любой сцены, кроме загрузочной (`game/app/boot/boot-screen-close.ts` на общей `onFirstScreen` из `game/app/boot/first-screen.ts`; страница звуков — сразу). Экран растворяется не раньше `minShowMs` от первой отрисовки, а страховочный таймер скрипта снимает его через `splashMaxMs` в любом случае, даже если модули не загрузились; если упал сам скрипт, экран убирается сразу. Плашки ошибок сборки разработки лежат выше экрана (`z-index` 99999 против 9000). Почему `localStorage`: сохранение на телефоне лежит в `@capacitor/preferences` и читается асинхронно, а счётчик нужен синхронно до модулей; `localStorage` страницы приложения (`capacitor://localhost`, `https://localhost`) хранится в данных приложения и переживает перезапуск, а его потеря только начинает очередь с башенки. Форма сохранения не меняется: язык и «Меньше эффектов» игра копирует в запись экрана при запуске и при смене настройки (`rememberBootPrefs`, `game/app/apply-settings.ts`). Возврат из фона страницу не перезагружает, поэтому экран не показывается; восстановление страницы из кэша скрипт не запускает. Параметры отладки (сборка разработки и внутренняя): `?loader=tower|oven` (или `a|b`), `?loader=reset` (счёт с нуля), `?loaderHold=мс` (держать экран), `?safe=верх,низ`.

## 8. Сервисы

Каждый сервис: файл `types.ts` с интерфейсом, `native.ts`, `web.ts`. Выбор в `services/index.ts` по `Capacitor.isNativePlatform()`, в одном месте. С M7 в приложениях нативные: `storage` (`@capacitor/preferences`: UserDefaults / SharedPreferences, те же строки под теми же ключами, что в браузере), `haptics` (`@capacitor/haptics`, `06`, раздел 8), `appShell` (`@capacitor/app` и `@capacitor/splash-screen`). Звук в приложениях тот же Web Audio, звуковая сессия iOS ставится нативно (`ios/App/App/AppDelegate.swift`, журнал). Реклама, покупки, аналитика, «поделиться» и уведомления остаются заглушками до M8.

Связь оболочки с игрой — `game/app/native-shell.ts` (`bindNativeShell`, в браузере ничего не делает). Приложение перестало быть активным (фон, звонок, пункт управления): сохранение пишется сразу, игре посылается `Phaser.Core.Events.HIDDEN` (цикл стоит, забег на паузе с окном паузы, звук и музыка держатся по причине `app`). Вернулось: `VISIBLE`. Звук в приложении (сессия 8, продолжение 2) слушается только оболочки: `audio.suspend('app')` при уходе из активного состояния и `audio.resume('app')`, когда приложение снова активно; видимость страницы (`visibilitychange`, она приходит на 0,3 с раньше активности, и WebKit тогда отвечает «Failed to start the audio device») звук в приложении не трогает, в браузере звук по-прежнему следует за ней. До того как веб-часть попросит контекст запуститься, нативная часть iOS уже активировала звуковую сессию (`AppDelegate`, по `didBecomeActiveNotification` и по концу прерывания). После каждого возврата контекст проверяется по факту (`06-art-animation-audio.md`, раздел 7, «Проверка контекста»). Звук в приложении стартует без касания: WebView обеих платформ разрешает воспроизведение без жеста. Заставку снимает загрузочный экран `index.html`, как только нарисован (раздел 7, «Загрузочный экран»); оболочка ещё раз снимает её после первого кадра любой сцены, кроме загрузочной, не позже `APP_SHELL.splashMaxMs` — на случай, если страница не смогла. Кнопка «назад» Android идёт в стек `game/app/back-stack.ts`: экраны и окна регистрируют обработчик (`pushBack`), срабатывает верхний, который взялся; если не взялся никто (главный экран), приложение сворачивается.

Заглушки для браузера:

| Сервис | Поведение заглушки в браузере |
|---|---|
| storage | `localStorage` |
| ads | `services/rewarded-video/web.ts`: серый экран (DOM) на 2 секунды с подписью «Реклама (заглушка)», затем `rewarded`; `showInterstitial()` показывает такой же серый экран на 2 секунды с подписью «Межстраничная реклама (заглушка)» (ключи `ads.stub`, `ads.stubInterstitial`) и отвечает `true`; в режимах `no_fill` и `offline` не показывает ничего и отвечает `false`. Режимы `reward` / `dismissed` / `no_fill` / `offline` переключаются кнопкой в панели отладки (`adsDev`, не входит в `Services`); в двух последних `rewardedUnavailableReason()` отдаёт свою причину |
| iap | `services/iap/web.ts`: DOM-окно «Купить (тест)?» с названием и ценой товара и кнопками «Купить» (`'purchased'`) и «Отмена» (`'cancelled'`); `window.confirm` не используется. Заглушка изображает стор: купленные разовые товары помнит под своим ключом `stub_store_owned` (`localStorage`, не в сохранении), поэтому `restore()` и `ownedNonConsumables()` возвращают их и после сброса прогресса `?reset=1`. Разовый товар второй раз не продаёт (`'failed'`). Цены заглушки лежат в `data/economy/iap-stub.ts`. Ид. товаров берутся только из `.env` (`VITE_IAP_*`, `services/iap/product-ids.ts`), товар без ид. в заглушку не попадает |
| analytics | Печатает события в консоль (только dev); в сборке без файла настроек Firebase и в продакшен-браузере молчит |
| crash | `services/crash/web.ts`: печатает `[crash] …` в консоль (только dev) |
| haptics | `navigator.vibrate`, если есть |
| notifications | Печатает расписание в консоль |
| consent | Сразу возвращает «согласие получено» |
| cloudSave | `services/cloud-save/web.ts`: без параметра облака нет (строки iCloud в настройках и окон облака нет). В разработке и внутренней сборке `?cloud=on` хранит копию под своими ключами `localStorage` (`stub_cloud_tippy_save`, `stub_cloud_tippy_save_prev`), изменение из другой вкладки приходит как уведомление хранилища (событие `storage`), так две вкладки изображают два устройства (у второй `?device=b`: её местное сохранение лежит под ключами с приставкой `device_b:`, облако общее); `?cloud=off` — «iCloud выключен», `?cloud=fail` — чтение и запись отказывают, `?cloud=slow` — чтение отвечает через 5 с (дольше тайм-аута); все вызовы пишутся в консоль строкой `[cloud] …` |
| games | `services/games/web.ts`: «недоступно» (кнопок игровых сервисов нет). В разработке и внутренней сборке параметр `?games=signed_in`, `signed_out`, `refused` (вход не выполнен, и вход отказывает, как после отказа игрока) или `unavailable` изображает сервис после тихого входа на Home; вход из `signed_out` удаётся сразу; все вызовы пишутся в консоль строкой `[games] …` |
| share | `services/share/web.ts`: `navigator.share` с файлом PNG, если `navigator.canShare({files})` разрешает, иначе скачивание PNG через ссылку `download`. Результат: `shared`, `downloaded`, `cancelled` или `failed` |

Детали нативных реализаций в `09-services-analytics.md`.

## 9. Отладка и инструменты баланса

Доступны только в сборке разработки (`import.meta.env.DEV`) через параметры адреса и клавиши:

**Внутренняя сборка и меню отладки.** В приложении нет адресной строки, поэтому для тестеров есть внутренняя сборка: `VITE_INTERNAL_BUILD=1` при сборке (флаги `INTERNAL_BUILD` и `DEBUG_TOOLS` в `util/build-kind.ts`). В ней работают параметры адреса отладки (`readDebugParams`), панель отладки `?debug` и проверочная страница звуков; хуки `tippySoak`, `tippyIdleAudit`, `tippyGame` и `__tippyAudio` остаются только в сборке разработки. Меню отладки открывается пятью быстрыми касаниями по строке версии в окне настроек (число касаний и окно времени в `data/debug/debug-menu.ts`). Оно собирает один адрес из выбора и перезагружает страницу с ним (по `location.pathname`, поэтому работает и на dev-сервере, и на локальном адресе приложения). Пункты: строка сборки сверху; два замера («Perf: no team» `?perf=1`, «Perf: master team» `?perf=1&mastery=master`) и проверочная страница звуков запускаются сразу; список «Run from» (начало каждой зоны, высоты контрольных точек помечены `cp`) в `?start=N`; место старта `?place=`; погода `?weather=`; переключатели счётчика кадров `?fps=1` и панели отладки `?debug=1` (они добавляются к адресу кнопки «Start»); «Normal start» (перезагрузка без параметров) и «Close». Раздел «Sound» (сессия 8, продолжение, `game/debug/sound-status.ts`): строка состояния звука раз в секунду (`formatAudioStatus`: время с запуска, состояние и часы контекста, выключатели музыки и звуков, тип звуковой сессии, что запрошено у музыки, плейлист или трек и какой, «грузится», число дек, пик шины музыки, удержания музыки и звука по причинам, число перезапусков сторожа) и кнопка «Copy sound report»: эта строка и последние 30 строк журнала звука в буфер обмена.

**Журнал звука** (сессия 8, продолжение, `services/audio/audio-log.ts`, числа `data/audio/audio-log.ts`). Кольцо из последних 200 строк с секундами от запуска: создание и состояния контекста, остановка и возврат звука по причинам, приход и уход приложения, скрытие и показ игры, запросы музыки, удержания, запуск, отказ и вход каждого трека, перезапуски сторожа, события элементов `audio` (`playing`, `pause`, `ended`, `error`, `stalled`, `waiting`). В сборке разработки и во внутренней сборке строки идут и в консоль с меткой `[audio]` (в приложении iOS их видно в журнале симулятора). Сборка трассировки (`VITE_AUDIO_TRACE=1`, процесс GitHub **iOS** с целью `trace`) пишет строку состояния в журнал каждые 2 с и делает несколько холодных запусков в симуляторе iOS, журнал каждого запуска хранится как артефакт 1 день. Забег из меню всегда идёт с `?start=`, поэтому в сохранение не пишется (`savesRun`). После замера на итоговой плашке и на странице звуков есть кнопка возврата в игру. Тексты меню не переводятся: это исключение из правила i18n, меню служебный инструмент, а не интерфейс игры. В сборке для магазина кода меню в пакете нет: проверка условия записана прямо как `import.meta.env.DEV || import.meta.env.VITE_INTERNAL_BUILD === '1'` перед динамическим `import()` (через общую константу сборщик ветку не отбрасывает); проверка: `npm run build` и поиск строки меню в `dist/assets/*.js` (должно быть пусто), то же при `VITE_INTERNAL_BUILD=1` (должна найтись).

| Инструмент | Как включить |
|---|---|
| Панель отладки (частота кадров, среднее и 95-й процентиль времени работы кадра, зерно, скорость летящего слоя, качка, высота, фаза, бригада, уровень эффектов `fx full`, `fx lite` или `fx minimal`, при автоматическом снижении метка `(auto)`, например `fx lite (auto)`) | `?debug=1` или клавиша `D`. В панели кнопки для телефона, где нет консоли: срезы `cut plain`, `cut strands`, `cut panic`, `cut big` (то же, что `window.tippyCut('<вариант>')`) и украшения `top cherry`, `top strawberry`, `top lemon`, `top mint`, `top wafer`, `top cream` (то же, что `window.tippySquash('<вид>', 'hit')`), с сессии 5г `lightning` (то же, что `window.tippyLightning()`: вспышка с молнией там, где гроза, иначе только испуг слоёв) и `yawn` (`window.tippyYawn()`: ближайший подходящий слой зевает); работают в идущем забеге, подписи английские, как у остальных кнопок панели (панель вне i18n) |
| Страж ключей | `scripts/secrets-guard.test.ts` входит в `npm run check` (этап M8): падает, если в отслеживаемых git файлах есть идентификатор AdMob (кроме общедоступных тестовых Google, издатель `3940256099942544`), ключ RevenueCat, ключ Google API, идентификатор приложения Firebase или сам секретный файл (`.env`, `GoogleService-Info.plist`, `google-services.json`, `ids.local.*`). Печатает только файл и вид находки, значение никогда |
| Страж docs | `scripts/docs-guard.test.ts` входит в `npm run check`: падает, если в `docs/**/*.md` есть управляющий символ (кроме перевода строки) или строка таблицы без шапки вне блока кода; если ссылка из `src`, `scripts`, `.github`, `CLAUDE.md` или `README.md` ведёт на несуществующий файл docs, раздел («section N», «раздел N» без заголовка `## N.` или `### N.`) или название в кавычках, которого нет в файле; если путь `src/...` или `scripts/...` с расширением в `docs/*.md` не существует (кроме архива, `10-roadmap.md` и `12-ideas-backlog.md`, где есть планы с будущими файлами) |
| Задать зерно | `?seed=12345` |
| Начать с высоты N | `?start=60` |
| Погода забега | `?weather=clear\|sunset\|night\|rain\|snow\|leaves\|storm` (такие забеги не сохраняются; в замере `?perf=1&weather=<имя>`, без параметра замер ясный) |
| Место старта (первая зона) | `?place=kitchen\|shop` (такие забеги не сохраняются; в замере `?perf=1&place=<имя>`, без параметра — домашняя кухня) |
| Бот, играющий сам с заданной точностью | `?bot=45` (стандартное отклонение в мс) |
| Бригада забега поверх сохранения | `?team=honey,jelly,brownie` (до 3 id через запятую, пусто или `-` — пустой слот, неизвестные id игнорируются) и `?level=N` (1..5); важнее бригады сохранения. `?team` без `?level` играет на уровне 3, `?level` без `?team` поднимает бригаду сохранения до N. Адрес с этими параметрами открывает сразу забег, а не Home. В панели отладки три слота (касание листает: пусто, затем каждое из 12 существ, начиная с бригады сохранения), уровень (`save` — уровни сохранения) и кнопка `restart`, которая начинает новый забег с выбранной бригадой. Забеги с такой бригадой (из адреса или из панели) в сохранение не пишутся |
| Выдать валюту, открыть всех существ | кнопки в панели отладки; сейчас есть «+50 berries», «+500 coins», «baker +1» (уровень пекаря +1, опыт уровня в ноль, награды не выдаются) и «creatures +1» (каждому из 12 существ +1 уровень до 5, не открытое открывается на 1-м); все пишут в сохранение |
| Счётчик дохода за сессию по источникам | В панели отладки под строкой `berries`: «session coins / berries / xp» с суммой и разбивкой. Монеты: `floating`, `combo`, `perfect`, `crumb`, `golden`, `mastery` (мастер-эффекты), `height` (источники забега из `RunTally`), `run_other` (остаток от округления), `ad_double` (×2 на результатах), `mission`, `streak`, `gift`, `gift_double`, `daily_tier`, `level_reward`, `shop_free`, `berry_exchange`, `purchase`, `debug` (кнопки панели). Ягоды: `run_berries` (золотые слои), `chest`, `streak`, `level_reward`, `daily_tier`, `debug` и т. д. Опыт: `run_xp`. Считает чистый накопитель `state/session-tally.ts`, его кормит единственная точка `GameState.commit` (разница кошелька между сохранениями) и `noteRun` для забега; существует только в сборке разработки (`sessionTally` в `state/index.ts`), в сохранение не пишется, при перезагрузке страницы обнуляется |
| Режим рекламы-заглушки | кнопка `ads reward/dismissed/no_fill/offline` в панели отладки: касание переключает ответ следующей рекламы; `no_fill` и `offline` — две причины недоступности (`rewardedUnavailableReason`, `09-services-analytics.md`, раздел 3), кнопки рекламы показывают «Реклама недоступна» или «Нет интернета» |
| Сброс покупок заглушки магазина | кнопка `Reset stub purchases` в панели отладки: стирает запомненные заглушкой покупки (ключ `stub_store_owned` в localStorage и память страницы), чтобы после сброса прогресса купленный пакет не вернулся при запуске. Сохранение не меняется; вне сборки разработки кнопки и функции нет |
| Обучение | `?tutorial=1` принудительно делает забег обучающим со свежими флагами, `?tutorial=0` отключает все подсказки. Без `?tutorial` любой из `?team`, `?level`, `?bot`, `?start` даёт обычный забег (без подсказок, флаги не трогаются). **Внимание:** без `?tutorial=0` и без этих параметров первый забег после загрузки страницы всегда обучающий (скорость ×0,6, подсказки, «Медок»), что искажает ручную проверку баланса. При `?bot` окно «Продолжить?» не открывается. Забеги с `?bot`, `?start`, `?team`, `?level` и с бригадой, выбранной в панели отладки, в сохранение не пишутся (результаты показывают плашку «Отладочный забег: не сохраняется»); `?tutorial`, `?seed` и `?debug` — обычная игра и пишутся |
| Сдвиг даты на N дней (проверка серии и заданий) | `?dayOffset=N`, целое от -3650 до 3650; применяет `util/clock.ts` (`now()`), других источников времени в коде нет. Исключение: `lastSeenAt` и проверка «часы назад» берут `realNow()` без сдвига |
| Новое сохранение | `?reset=1` (только сборка разработки): запуск с чистого сохранения, старое перезаписывается. После применения параметр убирается из адресной строки (`history.replaceState`), поэтому перезагрузка страницы или полная перезагрузка Vite не обнуляют сохранение снова |
| Счётчик кадров для проверки сборки на телефоне | `?fps=1` работает и в сборке разработки (dev-сервер, порт 5200), и в продакшен-сборке (единственный параметр, который не зависит от `import.meta.env.DEV`): два числа, частота кадров и среднее время работы кадра в миллисекундах, без текстов. Счётчик стоит слева сверху сразу под кнопкой паузы (место считается от реального размера холста: левый край и низ кнопки умножаются на масштаб логических пикселей в CSS-пиксели), чтобы не закрывать её. Остальные отладочные параметры в продакшене выключены (`util/debug-params.ts`: `showsFpsMeter`, `game/debug/fps-meter.ts`) |
| Замер производительности (бенчмарк) | `?perf=1` работает и в сборке разработки, и в продакшен-сборке (как `?fps=1`, не зависит от `import.meta.env.DEV`). Автоматический забег с фиксированным зерном (`PERF.seed` в `data/debug/perf.ts`) проигрывает 19 отрезков подряд, у каждого короткий прогрев без замера и окно замера 8-15 с (у отрезков смены зоны — до конца перетекания): `calm` (Кухня, бот), `tower` (башня из 59 слоёв с узорами и украшениями, Крыша), `lick-big` и `lick-short` (непрерывные большое и короткое слизывание), `rainbow` (бригада из Радужки 5-го уровня, дуга), `edge` (удары о край экрана на высокой скорости, Звёзды), `perfects` (бот с отклонением 1 мс, серия идеальных), `clouds` и `space` (старт с 60 и с 100 слоёв), `guest` (гость садится на башню), `cuts` (Кухня, старт с 8-го слоя, `OffsetDriver` бросает слой при смещении 5% его ширины, на каждом срезе принудительно нити; окно 19 с, не меньше 10 срезов, их число стоит в примечании строки), `collapse` (промах и обвал башни до экрана итогов), `results` (экран итогов с «Свежей печью»), `heavy` (сессия 5г: самая тяжёлая сцена — Крыша в снег независимо от `&weather`, ступенчатая стартовая башня с сугробами на выступах и следами слоёв, `OffsetDriver` бросает со смещением, на каждом срезе нити; бригада — через `&mastery=master`; тяжёлый отрезок, предел 60), пять отрезков смены зоны `transition-20`, `transition-40`, `transition-60`, `transition-80`, `transition-100` (старт за `PERF_TRANSITION.layersBefore` = 10 слоёв до границы зоны, без бригады, бот с отклонением 3 мс; окно открывается через 0,5 с после готовности забега, проходит всё, что смена зоны готовит заранее, и закрывается через `PERF_TRANSITION.tailMs` = 0,8 с после конца перетекания фона, не позже 40 с; не дошедший до границы забег пишет в примечании `no zone change`, а окно, кончившееся во время перетекания или его хвоста, — `window ended during the fade`; кадры перетекания (`GameScene.perfProbe().zoneFading`, то есть `Backdrop.fading`) считаются отдельно (в любом отрезке, где зона сменилась), и примечание строки показывает `fade N frames, draws max D, worst W ms`: число кадров перетекания, наибольшее число отрисовок в одном из них и худший кадр работы среди них). Данные отрезков и все числа замера лежат в `src/data/debug/perf.ts`. Замер никогда не пишет сохранение, не считается в задания, серию и рекорды, не показывает рекламу, окно «Продолжить?» и подсказки (`writesSave: false`, `noContinue: true`, `hints: false` в `RunSetup`). Уровень эффектов закреплён в памяти на время замера (`EffectsMode.pinLevel`, в сохранение не пишется, после замера закрепление снимается): по умолчанию полные эффекты, `&fx=full|lite|minimal` закрепляет соответствующий уровень (`&fx=reduced` оставлен как другое имя `minimal`), так что автоматический режим не меняет измеряемое. `&only=calm,edge` играет только перечисленные отрезки (в порядке замера). `&marks=1` кладёт пятно сока на каждый слой стартовой башни (замер башни со следами слоёв). Переключатели для сравнения на телефоне: `&dpr=1|1.5|2|3` ограничивает плотность холста (см. раздел 6, `capRenderDensity` в `game/app/render-density.ts`); `&units=1|2|4|8|16` задаёт число текстурных блоков в пакете отрисовки (`setMaxParallelTextureUnits`; на телефонах Phaser по умолчанию берёт 1 из-за `autoMobileTextures`, и каждая смена картинки становится отдельным вызовом отрисовки); `&nobg`, `&nofar`, `&nohud`, `&notower` не рисуют фон зоны (небо, слои и живые элементы), дальний план (узор), сцену HUD и слои башни (все `LayerView` сцены забега, включая летящий и падающие). Части скрываются только на время отрисовки кадра (`hidePartsWhileDrawing` в `perf/perf-parts.ts`: скрыть в `PRE_RENDER`, вернуть в `POST_RENDER`), логика игры этого не видит; фон и дальний план помечает сам `ZoneScenery` через `markPerfPart` (`perf/perf-marks.ts`, запись в WeakMap). Допустимые значения лежат в `PERF.densityCaps`, `PERF.textureUnits`, `PERF_PARTS`. `&still=tower|tongue|arc` (или id отрезка) играет один отрезок без замера и замораживает игру (`game.loop.sleep()`) в фиксированный момент: `tower` до первого приземления, `tongue` на пике языка (бит `hold` большого слизывания), `arc` когда радужная дуга выросла полностью; `window.__tippyPerf.stillReady` становится `true`, после чего харнесс делает снимок (запускать с троттлингом 1). Результат: таблица (отрезок, среднее, 95-й процентиль и худший кадр времени работы кадра в мс, среднее и 95-й процентиль интервала между кадрами в мс (на телефоне, где упирается видеочип, падение видно здесь, а время работы остаётся малым), число кадров, вызовы отрисовки на кадр, частота кадров) (каждое значение, вышедшее за бюджет кадра, помечено `!` в конце, у строки с превышением `!` стоит и после id отрезка; последняя строка под таблицей `budget: ok` или `budget: over in N segments (id, id, …)`; бюджет лежит в `PERF.budget` (`data/debug/perf.ts`) и пока предварительный: вызовы отрисовки на кадр не больше 40 у лёгких отрезков и 60 у тяжёлых (класс `drawClass` каждого отрезка, `light` или `heavy`), среднее время работы кадра не больше 8 мс, худший кадр не больше 50 мс (у отрезков смены зоны свой предел `PerfSegmentDef.workWorstMs` = 12 мс), средний интервал между кадрами не больше 18 мс, отрисовок в одном кадре перетекания зон не больше 60 (`PERF_BUDGET.fadeDrawsMax`; у любого отрезка, в окне которого сменилась зона, — кроме `transition-*` это `tower`, `rainbow`, `cuts`; `!` ставится после числа в примечании); отрезок без счёта вызовов отрисовки по ним не проверяется; та же сводка идёт в `window.__tippyPerf.budget` и в строку `[perf]`; чистые функции `budgetOver`, `formatBudgetLine` в `perf/perf-stats.ts`) с первой строкой-заголовком (`fx`, подложка холста в пикселях, размер в CSS-пикселях, `devicePixelRatio`, фактическая плотность, предел `&dpr`, текстурные блоки «в пакете/всего», скрытые части) в консоли и поверх игры: во время замера внизу экрана одна строка прогресса, по окончании (с сессии 7) на весь экран крупный итог для телефона: строка `budget:` зелёным или красным и по каждому отрезку отрисовки, худший кадр и кадры в секунду (значения сверх бюджета красные с `!`; чистая `summaryRows` в `perf/perf-stats.ts`, размеры и цвета `PERF.overlay`), подписи английские, как у панели отладки (инструмент разработки вне i18n); под итогом кнопки под палец «copy» (полный отчёт — заголовок, таблица и строка `budget:` — в буфер обмена; общий помощник `game/common/copy-text.ts`, им же пользуется пульт звуков) и «table» (раскрыть полную таблицу); «copy» кладёт в буфер через `navigator.clipboard`, по http без безопасного контекста через выделенный `textarea` и `execCommand('copy')`, а если и это не вышло, таблица раскрывается выделенной), объект `window.__tippyPerf` (`done`, `segments[]`, `header`, `table`, `budget: { ok, over: string[] }`) и строка консоли `[perf] {json}`. Время работы кадра берётся из `frame-work.ts` (PRE_STEP..POST_RENDER, только процессор; `setFrameWorkListener` отдаёт его замеру), а момент кадра для интервалов берётся из метки времени цикла (аргумент `time` события PRE_STEP, отметка `requestAnimationFrame`), поэтому интервал равен расстоянию между развёртками, а не зависит от времени работы кадра. Харнесс в Node (Playwright, мобильный экран 390x844 с масштабом 3, троттлинг процессора через CDP `Emulation.setCPUThrottlingRate`) лежит вне репозитория и принимает `--url`, `--throttle`, `--out`, `--only`, `--fx`, `--shots`. Этап «Мастерство существ» добавляет отрезок `mastery` (класс `light`, Кухня, бригада 5-го уровня «Медок, Желейка, Кислинка»: новый вид, покой и подписи мастера). Звук на время замера включён: `startPerfDirector` вызывает `services.audio.unlock()` (харнесс запускается с `--autoplay-policy=no-user-gesture-required`), поэтому числа «после» включают цену звука |
| Проверочная страница звуков | `?soundboard=1` (только сборка разработки; модуль `game/debug/soundboard.ts` подгружается динамически под `import.meta.env.DEV`, в релизную сборку не попадает). Вместо игры DOM-страница: ползунки шин (общая, музыка, эффекты; живые, не сохраняются), кнопка на каждый звук реестра (и на каждый набор аргументов) по разделам `drop`, `cut`, `topper`, `weather`, `creature`, `ui`, `reward`, под кнопкой код звука и текст «где звучит» (`soundboard.sound.<id>`), кнопка «Всё сразу» (бросок, колокольчик, монета, способность, шлепки обвала, музыка), раздел музыки (мелодии a/b/c, ступени 1-6, меню, стоп, реверберация, ручки «плёнка», «барабаны», «мелодия», кнопка «музыка + бросок + комбо»: вызывает `services.audio.music`) и метка «на решение владельца» у звуков с `ownerChoice`. `&lang=en` или `&lang=ru` переключает язык страницы |
| Запись звуков без устройства | Только сборка разработки: `window.__tippyAudio` (`game/debug/audio-hook.ts`): `ids` (все звуки и наборы аргументов с именами файлов), `render(id, args)`, `levels(id, args)` (длительность, пик, громкость RMS по звучащей части выше -60 dBFS, число обрезанных отсчётов), `wav(id, args)` (WAV 16 бит в base64), `many(список)` (несколько звуков со сдвигами через ту же цепочку и тот же допуск звуков, что в игре; в ответе `refused`), `measure` и `encode` для любого записанного куска (музыка). Запись идёт через `OfflineAudioContext` 44100 Гц, 2 канала, с теми же шинами и ограничителем (`services/audio/offline-render.ts`), шум на зерне (`core/common/rng.ts`), поэтому запись повторяется точно. Скрипт `.playwright-mcp/session6/a/tools/render-sounds.cjs` сохраняет WAV всех звуков и печатает таблицу |
| Проверка «нет неподвижных объектов» (раздел 10 документа 06) | В консоли браузера `await tippyIdleAudit(6)`: за 6 секунд (параметр) следит за всеми видимыми объектами сцен забега и HUD и возвращает отчёт `{ seconds, frames, objectsChecked, limitMs, still[], groups[] }`, таблицу групп печатает в консоль. Объект неподвижен, если не менялись он сам и все его родительские контейнеры (поза, масштаб, угол, прозрачность, оттенок, кадр, текст, сдвиг тайла) дольше `limitMs` (2 с); медленный дрейф считается движением. Объекты без `getBounds` (Graphics) попадают в отчёт с флагом `boundsUnknown`. Подключается динамическим импортом только в сборке разработки |
| Согласия как на телефоне | `?consent=1` (только dev и внутренняя сборка; `WebConsent` в режиме демонстрации): вопрос ATT открыт и параметры конфиденциальности предлагаются, поэтому видно окно-пояснение (после входа на Home с `stats.runs >= 1`) и пункт «Настройки конфиденциальности» в настройках. В браузере без параметра согласий нет |
| Проверка на утечки (заплыв) | Только сборка разработки: `window.tippySoak` (`game/debug/soak-driver.ts`, числа в `data/debug/soak.ts`). `start(rich?)` запускает круги (`start(true)` сначала наполняет сохранение: все существа куплены и улучшены, команда собрана, завершённых забегов `SOAK.richRuns` (= `FIRST_RUNS.quiet`), чтобы на Доме была кнопка стартового набора, как у игрока после первых забегов; числа в `SOAK.rich*`): смена команды на экране Команды (по очереди `SOAK.teams`, в каждой есть Радужка), три забега ботом (два до экрана итогов с «Играть ещё», третий бросается через окно паузы и «Заново»; в каждом забеге, как только башня позволяет, большое и короткое слизывание и шутка Радужки, выросшая дуга Радужки считается; счёт в `status()`: `teamChanges`, `bigLicks`, `shortLicks`, `jokes` (забеги, где шутка сыграла), `arcs`), обход Дом, Магазин, Коллекция, карточка существа с показом, Команда, ежедневная башня с забегом, экран нового существа, Дом с окном настроек в ru и en. С сессии 7 после забегов круга идёт забег с контрольной точки (по очереди 20, 40, 60, 80, 100, так что за пять кругов играются все зоны и их смены; ждёт итогов до `SOAK.zoneRunMaxMs`), а за ним экран итогов с рекордом из `resultsDemoData('record')` на `SOAK.recordDwellMs` (забеги бота в сохранение не пишутся и рекорда не ставят, поэтому празднование и музыка рекорда берутся из примера; счёт в `status()`: `zoneRuns`, `records`). Между кругами игра стоит на Доме: `parkNext()` останавливает её там, `sample()` (`game/debug/soak-metrics.ts`) читает числа живых вещей (объекты экранов рекурсивно, обновляемые, интерактивные, твины, таймеры, слушатели всех эмиттеров, текстуры по группам имён, объекты и буферы WebGL, канвасы текстур (источники текстур с `getContext`: запечённые картинки лежат вне страницы) и элементы canvas страницы, области интерфейса), `release()` отпускает. Запускать с `?bot=120` (иначе игра сразу начнёт забег; драйвер сразу выходит из этого первого забега на Дом, не дожидаясь его конца); для проверки «ноль ошибок и предупреждений в консоли» есть короткий скрипт `scripts/soak-check.cjs` (`PLAYWRIGHT_PATH=<папка пакета playwright> node scripts/soak-check.cjs --url http://localhost:5173/ --minutes 10 [--rich]`: играет `tippySoak`, собирает `console.error`/`console.warn`/ошибки страницы, код выхода 1, если они были или если заплыв ничего не сыграл (0 забегов или 0 кругов; сообщение называет стадию, на которой он стоит; окно короче первого круга, около 1,5 минуты, тоже даёт 0 кругов: берите не меньше 2 минут); без скрипта то же вручную из консоли: открыть `?bot=120`, `tippySoak.start()`, через 10 минут `tippySoak.status()`); скрипт Playwright с принудительной сборкой мусора (`HeapProfiler.collectGarbage`) перед чтением кучи и записью JSON каждую минуту хранится вне репозитория (`soak-harness.cjs`, флаг `--rich` наполняет сохранение); он же считает то, чего Phaser не видит: слушатели DOM (обёртка над `addEventListener`/`removeEventListener`), интервалы и узлы страницы. Результат первого полного прогона (30 минут, 150 забегов): рост от круга к кругу нулевой; текстуры (~260 при старте, ~390 к концу) растут только пока лениво запекаются новые картинки (цвета панелей, капли глазури, ширины слоёв: слои лежат в пуле с пределом `ANIM.pool.idleLayerTextures`), потом стоят. Рост от круга к кругу — ошибка, ограниченный кэш, который заполнился и стоит ровно, — норма. Быстрый круг `tippySoak.smoke()` (`SOAK.smoke`): один проход с насыщенным сохранением (baker `SOAK.richBakerLevel`, иначе магазин, улучшения и Радужка закрыты; Радужка стоит в первой ячейке команды `SOAK.smoke.teamIndex`) и ускоренным в 4 раза временем игры (множитель `soak-speed.ts` ставится в одном месте, в цикле игры: все сцены получают масштабированные часы и дельту, поэтому таймеры, твины и симуляция сохраняют относительные тайминги; дельта сверх `maxFrameMs` симуляции доставляется следующими кадрами, а не режется; вне круга множитель 1 и время идёт как есть): Дом, Команда со сменой состава, забег с большим и коротким слизыванием и шуткой Радужки (бот промахивается случайно, поэтому шаг играет до `SOAK.smoke.rainbowAttempts` забегов, пока не доберётся до слоя Радужки; шаг требует приращения счётчиков за сам шаг: большое и короткое слизывание, сыгранная шутка (`RunHooks.jokesPlayed`) и выросшая дуга Радужки), итоги, «Ещё раз», пауза (забег в этот момент должен идти, окно паузы должно открыться) и «Заново», забег с контрольной точки, ежедневная башня, магазин, коллекция и карточка существа, настройки с переключением языка и обратно; числа объектов, слушателей и твинов на Доме до и после должны совпасть (чтение повторяется, пока два подряд не сойдутся). `node scripts/soak-check.cjs --url <адрес> --smoke` печатает одну строку `smoke: ok, steps 9/9, 0 messages, objects A=A, listeners B=B, tweens C=C, jokes J, arcs A, T s` и выходит с кодом 1 при любом сообщении консоли, неравных числах или незавершённом шаге. `npm run soak:auto -- [--base <ref>] [--url <адрес>] [--playwright <папка пакета>] [--minutes 5]` (`scripts/soak-auto.cjs`; предпочтительная запись `npm run soak:auto -- --base <ref>`: без `--` npm печатает «Unknown cli config», хотя ссылка всё равно доходит; ссылка проверяется через `git rev-parse --verify`; нужен `PLAYWRIGHT_PATH` или `--playwright`; без `--url` сам поднимает vite на свободном порту) берёт файлы, изменённые относительно `--base` (по умолчанию `origin/master`), и неотправленные, и выбирает уровень (`scripts/soak-level.cjs`, списки шаблонов там же): ничего (только `docs/`, `*.md`, `src/i18n/`, `src/data/`, `scripts/`, `*.test.ts`); быстрый круг (любой другой код игры); быстрый круг и 5 минут случайной игры (сцены `src/game/scenes/` и их жизненный цикл: `per-scene`, `run-restart`, `run-exit`, `results-launch`, `scene-keys`; пулы и заготовленные объекты: `landing-prep`, `collapse-prep`, `timed-pool`, `tongue*`, `lick*`; атласы и текстуры: `shared-atlas*`, `bake-texture*`, `*-textures.ts`; сохранение: `src/core/`, `src/state/`, `services/storage/`; обёртка `fx-guard*`). Печатает уровень, файлы-причины и одну итоговую строку `soak:auto: <уровень> ok (<файлы>) — ...` (для «ничего»: `soak:auto: none (...) — nothing run`). Когда запускать: правило 9 в `CLAUDE.md`; долгий прогон 60–90 минут только перед вехами (M7, релиз), в обычном времени. Не покрыто: поделиться картинкой, окно «Продолжить?» (у бота его нет), покупки, обучающий забег. Сессия 6: в выборку входит `audioNodes` (живые узлы Web Audio, `services.audio.debugStats()`); дым-круг сравнивает их до и после с допуском `SOAK.audioNodesTolerance` (`game/debug/soak-compare.ts`), заплыв включает звук в начале (`services.audio.unlock()`), а `scripts/soak-check.cjs` запускает Chromium с `--autoplay-policy=no-user-gesture-required` |
| Придавливание украшений (отладка) | Только сборка разработки: `window.tippySquash('<вид>', 'hit' \| 'edge' \| 'none')` (`game/debug/squash-debug.ts`): вид `cherry`, `strawberry`, `lemon`, `mint`, `wafer` или `cream`; красит верхний слой под вид и, когда летит следующий, роняет его на украшение целиком (`hit`), на его край (`edge`) или мимо украшения без украшения вовсе (`none`, контроль для замера отрисовок); возвращает `true`, если верхний слой простой. На телефоне те же вызовы делают кнопки `top <вид>` панели отладки (с `hit`). `window.tippySquashLevel('full' \| 'lite' \| 'minimal' \| null)` закрепляет уровень эффектов. Замер отрисовок во время смятия (headless, iPhone, 40 кадров после касания, против посадки без украшения): добавка не больше 0 за кадр в среднем и в максимуме. |
| Страж обрезки картинок | Только `?artsheet=1` (сборка разработки). `bakeTexture` после каждой запечённой картинки рисует её второй раз в поле на `CLIP_PROBE_PAD` (48 px) больше со всех сторон (`probeClip`, `game/common/clip-guard.ts`; подсчёт в `util/edge-clip.ts`, с тестом) и считает непрозрачные пиксели (альфа выше `CLIP_ALPHA_THRESHOLD`, 24) в этом запасе: это то, что настоящее поле обрезает. Итог печатается в консоль и под сеткой листа: `clip: ok` или `clip: N offenders` и список (ключ, сторона, число пикселей, на сколько px вылезает), ниже `atlas pages: N` (должна быть 1) и в консоли список «тесных» картинок (меньше `CLIP_MIN_SPARE` = 3 px свободного поля, но не обрезанных). Белый список с причиной на каждую запись: `CLIP_ALLOWED` в `src/data/debug/clip-guard.ts` (шаблон ключа, стороны, причина). Исправление: увеличить поле, не рисунок (`bakePadded` и `paddedOrigin`, числа в `src/data/common/picture-fields.ts`, у украшений слоёв поле `field` в `plain-toppers.ts`). Не проверяются картинки, загруженные из файлов, и динамические текстуры (значки существ, неподвижный фон, карточка) |
| Общий лист картинок | `?artsheet=1` (только сборка разработки): вместо первого экрана сцена `ArtSheetScene` (`game/debug/art-sheet-scene.ts`) выводит сеткой все картинки реестра текстур, каждую с подписью-ключом (ключи Phaser `__*` и кэши слоёв `layer_*` отбрасывает `data/debug/art-sheet.ts`). Лениво запекаемые картинки сначала запекает `primeArtTextures` (`game/debug/art-sheet-prime.ts`, список `PRIME_STEPS`: новому ленивому запекателю нужна одна строка). Картинки без текстуры (рисованные контейнеры, например значок «Без рекламы») лежат в списке `LIVE_PICTURES` (`game/debug/art-sheet-live.ts`, одна строка на картинку) и идут отдельным рядом под сеткой. Один снимок страницы и есть общий лист `all-art-sheet.png` |
| Скриншоты для сторов | `npm run store:shots` (`scripts/store/`, раздел 5 документа 11). Внутриигровая половина — `window.tippyStore` (`game/debug/store-stage.ts`, только сборка разработки, подключается в `main.ts` динамическим импортом): `begin(id)` ставит кадр из `data/debug/store-shots.ts` (забег по параметрам адреса или экран меню), на каждом шаге игры роняет слои своим водителем (`DropDriverSlot.set`) и ловит момент, `status` становится `ready` на шаге, чей кадр снимается; `creatureArt(...)` рисует существо (`LayerView`, выросший вид, лицо по реакции) крупно на прозрачной картинке. Скрипт останавливает часы страницы (`clock` Playwright) и двигает их по 16 мс, пока не идёт загрузка файла, поэтому кадры повторяются побитово |
| Редкий гость Космоса | `?spaceGuest=eclair\|saucer\|teapot\|comet` (только сборка разработки): в этом забеге гость пролетает через 0,8 с после появления «Космоса» (например `?tutorial=0&start=105&spaceGuest=saucer`). Без параметра гость выпадает на каждом витке Космоса по шансу (`SPACE_VISITOR.chancePerLap`, 0,5; `visitorOfLap`); в замере `?perf=1` без параметра гостя нет, чтобы замеры были сравнимы |
| Строй из 12 существ (временный инструмент проверки рисунка M4, убрать после утверждения внешнего вида) | `?lineup=1`: вместо забега сцена `LineupScene` показывает башню из 12 слоёв-существ разной ширины со срезами слева и по одному целому слою справа; настройки в `data/debug/lineup.ts` |

**`npm run sim`** запускает `scripts/sim.ts`: без отрисовки проигрывает по 2000 забегов для каждого профиля игрока и набора бригад и печатает таблицу: медиана и 90-й перцентиль высоты, средние монеты, средняя длительность. Используется для проверки ожиданий из `02-gameplay.md`, раздел 12.

Флаг `--all-teams` берёт за полные бригады все 220 сочетаний по три существа (порядок слотов как в `CREATURE_IDS`): обычная таблица по профилям (без бригады, одиночки, именные бригады) остаётся, а вместо 220 строк по каждому профилю печатаются сводка (5 лучших по медиане и по монетам, число бригад в диапазонах +30..+50% и свыше +50%, бригады свыше +50% с «Радужкой», без неё но с «Безешкой», и без обеих), строка «jelly solo» и итоговые критерии приёмки (одиночная «Желейка» на обычном профиле +8..+14%, нет доминирующей бригады, нет бригад свыше +50% без «Радужки» и «Безешки»). «Свыше +50%» везде считается с допуском владельца 3 процентных пункта: бригада попадает в эти списки и проваливает критерий, только если её прирост больше +53%; число бригад «в +30..+50%» считается без допуска. Проверка доминирования считается по 220 бригадам только с этим флагом. Без него шесть именных бригад для неё слишком малая выборка: `npm run sim` не выносит вердикт «FAIL» и не пишет «balance needs changes» по ним, а для каждого профиля печатает «dominance: not checked, the check needs --all-teams», итоговая строка гласит «verdict: the dominance check needs --all-teams». Строка об именных бригадах в диапазоне +30..+50% к медиане (справочная) остаётся. В таблице есть колонка `median zone`: зона, в которой закончился медианный забег.

В конце `npm run sim` печатает статистику качки по профилям без бригады (`scripts/wobble-stats.ts`): средняя и медианная качка в момент касания, доля касаний при качке выше 40 и выше 70, средняя амплитуда верхушки в пикселях, доля касаний с амплитудой больше допуска «идеально», число чихов за забег. Первый слой, который падает на поднос, не считается.

После неё ещё две таблицы по профилям без бригады (`scripts/end-stats.ts`): в какой зоне закончились забеги (% забегов) и какое правило действовало на слое, на котором забег проигран: «kitchen», «showcase side» (Витрина без рывка), «rush», «roof», «cloud at tap» (облако закрывало слой в момент касания бота), «clouds clear» (слой зоны Облаков, не закрытый в момент касания), «fake-out» (обманка этого слоя сработала), «stars no fake-out», «sneeze» (забег кончился чихом). Слои Космоса считаются по выпавшему правилу. Наблюдатели статистики подключаются к бот-забегу через `scripts/run-observer.ts` и на результат не влияют.

**`npm run sim:speed`** (`scripts/speed-curve.ts`) печатает номинальную скорость каждого слоя 1–160 (1–165: каждый 5-й слой и слои, где что-то меняется: начало зоны, выход дуги на 1250 на высоте 160) и время одного пролёта между стенами на слоях 1, 20, 40, 60, 80, 100, 120. Пролёт считается по ширине хода центра слоя `maxCenterX − minCenterX` = 800 px без профиля крыши и рывка. `npm run sim:speed-variants` (`scripts/speed-variants.ts`) играет вариации темпа через `speedScale`: «волна» (в начале каждой зоны со 2-й скорость ниже на 10% или 15% и линейно растёт до номинала к последнему слою зоны), «награда за серию» (после 5 идеальных подряд следующие 3 слоя на 15% медленнее, не чаще раза в 10 слоёв); вариант «Космос ×1,05» убран вместе с множителями зон (2026-11-16). Сравнение идёт на одних и тех же зёрнах для профилей «сильный», «обычный», «опытный» без бригады и со стартовой бригадой.

Профиль `strong` («сильный игрок», 20 мс) в `DIFFICULTY.targets` помечен `analysisOnly`: обычный `npm run sim` его не играет, чтобы таблицы и критерии приёмки по расчётным профилям не менялись; он включается флагом `--profile=strong`. `npm run sim:strong` (`scripts/strong-fit.ts`) печатает разброс высоты и монеты по источникам для забегов на 95–105 слоёв рядом с данными живого игрока. Прицеливание бота в парящую монету проверено замером и ничего не даёт, навыка в `core/tower/bot.ts` нет. Общий код сим-скриптов (один забег бота, перцентили, потоки зёрен) лежит в `scripts/sim-runner.ts`.

**`npm run sim:coins`** (`scripts/coin-sources.ts`) печатает для четырёх профилей (новичок, обычный, опытный, сильный) средние монеты за забег по источникам (парящие, идеальные при комбо от 5, золотые слои, бонус высоты, монеты способностей «идеальный» и «крошка», мастер-эффекты `mastery`), средний опыт (с «Свежей печью», см. `04-meta-retention.md`: первые слои дня по 1 опыту, дальше 1 за 6, поэтому он не равен высоте) и среднюю длительность забега в секундах симуляции, а также медиану, p10 и p90 высоты, монет и длительности. Три набора бригад: без бригады, стартовая бригада нового сохранения (`SAVE_DEFAULTS`: «Медок» 1-го уровня) и самая «монетная» полная бригада, найденная перебором всех 220 сочетаний на уровне существ 1 и 5. Перебор грубый: каждая бригада играется `--search-runs=N` раз (по умолчанию 300), пять лучших переигрываются полным числом забегов (`--runs=N`, по умолчанию 2000), победитель выбирается по средним монетам; порядок слотов не перебирается (как в `--all-teams`). Длительность не включает замедление при промахе, окно «Продолжить?» и экран результатов: это часы симуляции до приземления слоя, которым кончился забег. Забег, дошедший до высоты `--max-height=N` (по умолчанию 1500), обрывается: бот с сильной бригадой 5-го уровня почти не промахивается, а бесконечный забег сделал бы среднее бессмысленным; такие забеги считаются в колонке `cut`, бонус высоты им начисляется как при окончании на этой высоте. `--json=путь` пишет те же числа и распределения в JSON для экономической модели, `--profile=id` играет один профиль.

**`npm run sim:economy`** (`scripts/economy-model.ts`) — модель экономики по дням, только для анализа. Скрипт играет ботом по 1000 забегов на профиль (новичок, обычный, опытный, сильный) с двумя бригадами: стартовой (Медок 1-го уровня) и монетной (Карамелька, Безешка, Радужка 1-го уровня), и хранит по каждому забегу высоту, монеты по источникам, ягоды и длительность (`--cache=путь` сохраняет выборку в JSON и читает её при следующем запуске; вместе с выборкой в файле лежат число забегов и значения `--set`, с которыми она сыграна, и кэш с другими значениями отвергается с ошибкой, а не читается молча, `scripts/sample-cache.ts`). Затем выборка оценивается по двум экономикам: `CURRENT` читает правила игры из `src/data/` и `src/core/` (свежая печь, кривая опыта, условия прокачки с правилом легендарного, «Двойняшки» за монеты, предел «×2», монеты за серию и высоту), а `BEFORE` — замороженная прежняя экономика для сравнения (выборка играется текущей симуляцией, поэтому старые правила монет пересчитываются из источников). Расчёт опирается на объём игры (число забегов в минутах дня), а не на фиксированные «8 забегов в день». Игрок играет заданное число минут в день (30 или 210): экран результатов 20 с, реклама 30 с; с рекламой «×2» после каждого забега (до дневного предела), подарок ×2, 3 раза бесплатные монеты магазина, +1 попытка башни дня. Каждый день добавляются серия (по календарю, Брауни на 7-й день), подарки (2 в день при 30 минутах, 4 при 210), задания (доля выполнения по профилю — оценка), сундук, башня дня с 5-го уровня (3 попытки, ступени по лучшей высоте), награды уровней. Монеты тратятся жадно: сначала новое существо дешевле 900 монет, иначе самый дешёвый шаг (существо или прокачка), ягоды меняются на монеты пакетом 100 → 1400. Печатаются монеты и опыт за забег и за час и дни до первой и второй покупки, полной коллекции с прокачкой до 5 (все 12, «Двойняшки» по рекорду 75 или за монеты с 14-го уровня; отдельно без них) и уровней пекаря 5, 10, 15, 20, а затем таблицу критериев приёмки экономики (обычный: 60–90 дней до полной коллекции и 20-го уровня пекаря; сильный: не раньше 28-го дня; первая покупка в первый день, вторая не позже третьего, 5-й уровень пекаря не позже второго дня). Параметры `--current` печатают только текущую экономику. Бригада в модели не растёт со временем, поэтому стартовая и монетная бригады — нижняя и верхняя оценки дохода. Исключение — мастерство (этап «Мастерство существ», `05-economy-monetization.md`, раздел 3): с дня, когда модельный игрок дошёл до 16-го уровня пекаря, забеги берутся из выборки той же бригады на 5-м уровне с мастер-эффектами («Радужка» на 4-м до 20-го уровня пекаря), без проверки, куплены ли улучшения (верхняя оценка); отдельная строка критериев играет сильного игрока с самой монетной бригадой 5-го уровня из `npm run sim:coins` с того же дня (`BEST_COIN_TEAM_L5` в скрипте, `--mastery-team=a+b+c` заменяет её; выборки этапов мастерства играются отдельными потоками зёрен, поэтому выборки 1-го уровня и строки до 16-го уровня пекаря не меняются; старты с точки берут выборку 1-го уровня). В `npm run sim:coins` монеты мастер-эффектов идут отдельной колонкой `mastery`.

**`npm run sim:first40`** (`scripts/first-layers.ts`) разбирает, почему забеги кончаются на первых 40 слоях: по профилям (`--profiles=`, по умолчанию все четыре) и бригадам (`--teams=none,reliable@3,honey@1`, уровень после `@`) печатает распределение высоты конца (квартили, p90, доли ниже 20/40/80 с шумом 95%), гистограмму, опасность слоя по полосам по 5 слоёв (P(проигран на слое | дошёл до него)), причину конца забегов ниже 40 и медианную ширину и скорость летящего слоя на слоях 10/20/30/40. Причины (первая подходящая): «sneeze» — чих; «sway» — промах, который приземлился бы без раскачки верхушки за время падения; «rush» — промах на слое с рывком, который приземлился бы без множителя рывка; «speed» — промах по слою шириной не меньше ширины продолжения (360), то есть одна крупная ошибка; «narrowing» — промах по слою уже 360. Дополнительно: доля концов на слое «Витрины» без рывка и доля промахов, которые приземлились бы на базовой скорости первого слоя. Разбор 2026-11-19: `_archive/10-roadmap-history.md`, «Разведка: первые 40 слоёв».

**Значения «что если»** для подбора баланса: `--set=...` у `npm run sim:teams`, `sim:coins`, `sim:economy` и `sim:first40` (`scripts/what-if.ts`) переписывает данные в памяти перед первым забегом, элементы через `;`: `frosty.slowPercent.5=33` (любое число способности по уровням, `<существо>.<поле>.<уровень>`, например `jelly.springPercent.5=47`), короткая запись `honey.4=44` (допуск «Медка», расширение «Пышки» `puff.N`, слои «Безешки» `ghost.N` на уровне N), `mastery.frosty.toleranceAdd=12` (любое число `MASTERY`), `difficulty.ghostCloudSdMult=1.1` (допущения бота), `zones.rush.speedMult=1.2` (любое число `ZONE_RULES`), `balance.speed.start=540` (любое число `BALANCE`; допуск «идеально» `balance.drop.perfectTolerance` переписывается и в базовых модификаторах броска `BASE_MODIFIERS`, которые копируют его при загрузке). Непонятный элемент — ошибка. `npm run sim:teams -- --report=...` печатает в заголовке медиану строки `none` и числа забегов (отношения делятся на эту медиану; если у `none` другое число забегов, чем у бригад, печатается предупреждение), лучшие бригады без «Радужки» и с ней отдельно, строку цели владельца (лучшая без «Радужки»: не больше ×2,2 к медиане без бригады, 99-й перцентиль не выше 700, обрезанных забегов нет) и бригады с «Радужкой» выше ×2,2 для владельца.

## 10. Тестирование

| Что | Как |
|---|---|
| `core/tower/drop.ts` | Таблица случаев: идеально, обычный слева/справа, граница промаха, липучка, авто-идеал |
| `core/tower/wobble.ts` | Рост, затухание, чих на 100, амплитуда по глубине |
| `core/tower/tower-sim.ts` | Детерминизм: одно зерно и одна последовательность касаний дают одинаковый результат; сценарии продолжения и щита |
| `core/abilities/*` | Каждый уровень каждой способности, усиление, продление эффектов |
| `core/zones/zones.ts` | Расписание событий одинаково для одного зерна |
| `core/progression/streak.ts`, `missions.ts`, `daily.ts` | Смена дня, пропуск дня, перевод часов назад, UTC против местного времени |
| `core/economy/economy.ts` | Нельзя уйти в минус, нельзя купить дважды, цены из данных |
| `core/save/*` (`save.test.ts`) | Каждая миграция (цепочка подменяется в тесте), повреждённый JSON, пустое сохранение, будущая версия, нормализация |
| `core/progression/progression.ts`, `util/calendar.ts`, `util/clock.ts` | Уровни и награды; дни по местному и UTC времени и `clockWentBack` (`calendar.ts`, без зависимостей от сборки), текущее время с `?dayOffset` (`clock.ts`) |
| `state/game-state.ts` | Загрузка (новое, основное, копия, повреждённое), задержка записи и ротация копии, запись при сворачивании, правило рекорда, монеты в конце забега, ягоды сразу, баланс не уходит в минус, подсказки и настройки между запусками, награды уровней (хранилище, часы и таймеры подставляются) |
| Данные | Тест целостности: у каждого существа есть ключи i18n, способность в реестре, способ получения; ключи en и ru совпадают |

Целевое покрытие `src/core`: ≥ 85% строк. Сцены юнит-тестами не покрываются; для них есть ручной чек-лист в дорожной карте и режим бота.

## 11. Локализация

- `i18n/en.json` и `ru.json` с одинаковым набором ключей. Вложенные ключи: `creature.honey.name`.
- Подстановки: `{value}`, `{n}`. Множественное число через `Intl.PluralRules` (в русском три формы: слой, слоя, слоёв).
- Язык по умолчанию определяется по системе; если не ru, используется en.

## 12. Журнал технических решений

Журнал ведётся в [`_archive/08-tech-journal.md`](_archive/08-tech-journal.md): почему принято то или иное решение и что было раньше.

## 13. Бюджет кадра

Игра на телефоне упирается в видеочип, а не в процессор: на iPhone Phaser кладёт в пакет отрисовки одну текстуру (`autoMobileTextures`), и каждая смена картинки — отдельная отрисовка. Числа взяты с запасом от достигнутых после прохода M6c (16.11.2026), а не идеальные. Отрисовки и времена телефона сверяются автоматически: `?perf=1` помечает значения сверх бюджета `!` и пишет в конце `budget: ok` или `budget: over in N segments (…)` (числа в `PERF.budget`, `src/data/debug/perf.ts`). Бюджет проверяется прогоном `?perf=1&mastery=master` (в отрезках без своей бригады играет бригада 5-го уровня, как у настоящего игрока); прогон `?perf=1` без бригады — для сравнения, итог `budget: ok` нужен в обоих. Задача, после которой итог `over`, не готова. `perfects` с 2026-11-16 — тяжёлый отрезок (порог 60, решение владельца: вариант (а), журнал выше и абзац под таблицей).

| Что | Бюджет | Достигнуто (headless Chromium, 390×844, iPhone user agent) |
|---|---|---|
| Отрисовок на кадр, спокойные отрезки (`calm`, `edge`, `results`) | ≤ 40 | без бригады 28–35; с `&mastery=master` 30–39; с сессии 7 (цифры HUD с общего листа) с `&mastery=master` 30,1–37,5 |
| Отрисовок на кадр, тяжёлые отрезки (`tower`, `lick-big`, `lick-short`, `rainbow`, `clouds`, `space`, `guest`, `collapse`, `heavy` (сессия 5г); `perfects` с 2026-11-16) | ≤ 60 | одна страница атласа 4096×4096 (с сессии 5б горы, планеты и картинки облака/туманности/края круга на своих текстурах, `clouds`/`space` +0,2–0,9 отрисовки): без бригады 25–42, с `&mastery=master` 28–42 (дуга Радужки 42, `guest` 41); с двумя страницами 4096×2048 было до 58 и 61–64 |
| Смена зоны (`transition-20` … `transition-100`): худший кадр работы | ≤ 12 мс в headless (`PERF_TRANSITION.workWorstMs`) | после правки 4,8–8,8 мс, с `&mastery=master` 5,8–6,9 мс; кадры самого перетекания 1,9–5,9 мс (до правки 2,6–7,6 мс; при замедлении ×4 до правки 27–42 мс, после 10–15 мс). Журнал, «Просадка на смене зоны» |
| Смена зоны: отрисовок в одном кадре перетекания (`fade draws max` в примечании) | ≤ 60 (`PERF_BUDGET.fadeDrawsMax`) | без бригады 39–53, с `&mastery=master` 49–57 (больше всего Кухня → Витрина) |
| Работа кадра, среднее, телефон без замедления | ≤ 8 мс | iPhone 14 Pro Max: до прохода 5,4–10,9 мс; после — в бюджете во всех отрезках, кроме `rainbow` 9,14 мс (правка дуги — ниже в журнале); headless ×1 0,6–1,3 мс |
| Интервал между кадрами, среднее, телефон | ≤ 18 мс | iPhone 14 Pro Max: до прохода 17,5–22,8 мс (44–57 кадров); после 16,7–17,4 мс: calm 59,7, tower 59,6, lick-big 59,9, lick-short 59,9, rainbow 57,5, edge 60,0, perfects 59,2, clouds 59,6, space 59,7, guest 59,9, collapse 58,5, results 59,9 кадра |
| Худший кадр работы, телефон | ≤ 50 мс | iPhone после прохода — в бюджете (с `&units=16` в calm 207 мс) |
| Работа кадра при замедлении ×4 (CDP), среднее | ≤ 6 мс | 1,7–4,5 мс |
| Худший кадр при замедлении ×4 | ≤ 60 мс | до 45–50 мс (обвал), остальные ≤ 25 мс |
| Плотность холста (пикселей холста на CSS-пиксель) | полный 2, облегчённый 1,75, минимальный 1,5 (`RENDER_DENSITY.capByLevel`, `data/app/screen.ts`) | на 430×932: холст 860×1864 вместо 1080×2341. iPhone 14 Pro Max: при 2 — 57,5–60 кадров; `&dpr=3` — 43–57 кадров, 9 отрезков вне бюджета: решала закраска, предел 2 подтверждён. `&units=16` (16 текстур на пакет) выигрыша не дал и в игре не включается |
| Полноэкранные полупрозрачные слои | не больше, чем есть сейчас в зоне (небо, дальний план, 3–4 полосы); новые затемнения и полноэкранные слои — только вместо существующих | 7,5–8,7 площади экрана в забеге, 2,6 на экране итогов |
| Память текстур (сумма ширина × высота × 4 уникальных источников) | ≤ 150 МБ | около 89–122 МБ: страница общего атласа 4096×4096 — 64 МБ с первого кадра (страница создаётся при загрузке, не посреди забега: `BootScene.create` переносит картинки лиц на атлас, и первая из них открывает страницу; это один долгий кадр загрузки с выделением 64 МБ. Запасной путь — все страницы игры 4096×2048: если `MAX_TEXTURE_SIZE` меньше 4096; если сразу после заливки большой страницы WebGL вернул любую ошибку (`OUT_OF_MEMORY`, `INVALID_VALUE`, `INVALID_OPERATION`, `INVALID_ENUM`; ошибки, оставшиеся от другого кода, вычитываются до заливки); если контекст потерян во время заливки или в течение `bigPageStrikeMs` (5 с) после неё — тогда страницы пересобираются меньшими ещё до восстановления, и `RESTORE_WEBGL` создаёт уже маленькие текстуры и заливает клетки заново. Потеря контекста позже этого окна странице не засчитывается: большая страница остаётся, `RESTORE_WEBGL` заполняет её заново; решение — чистая функция `bigPageFails`, `util/gl-page-error.ts`) (с сессии 5б запас высоты полок в пике ≥ 0,2: 0,21 с бригадой и 0,24 без, см. журнал; своими текстурами стали горы, планеты, `tr_cloud`, `tr_nebula`, `tr_lap_edge`, около 3,4 МБ; замер с такой же страницей до её временного уменьшения; со страницами 4096×2048 было 57–90 МБ до открытия второй, а на высокой башне вторая открывалась и давала те же 64 МБ) |
| Рост памяти за 30 минут прогона `window.tippySoak` | куча после сборки мусора не больше +5 МБ; число объектов, слушателей и таймеров между забегами не растёт; число текстур ограничено кэшем | +2,9 МБ за 15 минут (до прохода); 5 минут после прохода без роста |

Телефонные строки сверяются по таблице `?perf=1` на устройстве (dev-сервер или продакшен-сборка, `fx=full`), строки «×4» — харнессом в Node с `Emulation.setCPUThrottlingRate`. Бюджет отрисовок проверяется при одной текстуре на пакет (как на телефоне по умолчанию); `&units=16` — только для сравнения.

**Интервалы кадров считаются в вердикте только на настоящем устройстве** (решение владельца 2026-11-16). В headless-браузере интервал между кадрами гуляет 18,2–19,4 мс при работе кадра 1,4–2 мс: это шум автоматического браузера, а не видеочипа. Поэтому в автоматическом браузере (`navigator.webdriver === true`, `HeadlessChrome` в user agent, либо user agent телефона при настольной платформе (`navigator.platform` или `userAgentData.platform`: Windows, Linux x86, Mac) или при `maxTouchPoints === 0`, то есть эмуляция в devtools; `isAutomatedBrowser` в `game/perf/perf-stats.ts`, подмена одного iPhone user agent не обманывает) колонки интервала печатаются для справки, без пометки `!` и не влияют на строку `budget:`; отрисовки, работа кадра (среднее, p95) и худший кадр проверяются везде. Режим назван в строке над таблицей: `intervals: reference (automated)` или `intervals: counted (device)`. Чистый вердикт: `budgetVerdict(rows, automated)`.

**Почему `perfects` — тяжёлый отрезок** (решение владельца 2026-11-16). С бригадой 5-го уровня отрезок даёт 39–41 отрисовку при 34–35 без бригады. Прибавку около 4,6 дают не слои существ, а тексты HUD бригады: окошко «через N слоёв» около 3 и счётчики значков эффектов около 2 (у каждого `Text` своя текстура, на iPhone каждая — отдельная отрисовка), мир около 0,5. На iPhone 14 Pro Max владельца 60 кадров держатся и при 54 отрисовках. Поэтому порог отрезка 60, как у тяжёлых. Перевод счётчиков и окошка на цифры с общего листа сделан в сессии 7 (журнал 2026-11-19): с бригадой `perfects` 40,7 → 39,4, выигрыш меньше ожидавшихся 4–5, потому что значков на экране одновременно 1–2. Отрезок оставлен тяжёлым: запас до 40 меньше разброса между прогонами (журнал 2026-11-19).
