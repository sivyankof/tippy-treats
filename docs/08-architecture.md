# 08. Архитектура

## 1. Стек

| Слой | Технология | Примечание |
|---|---|---|
| Язык | TypeScript 5.x, `strict` | |
| Движок | Phaser 4.x (на ноябрь 2026 ветка 4.2) | Рендерер WebGL. Сверяться с документацией v4, не v3 |
| Сборка | Vite | |
| Нативная оболочка | Capacitor 8.x | Capacitor 9 ожидается в конце ноября 2026. Начинать на 8, обновиться после стабилизации плагинов |
| Тесты | Vitest | Только для `src/core` и `src/services` (заглушки) |
| Линтер | ESLint + Prettier | |
| Пакетный менеджер | npm | |
| Нативные зависимости iOS | Swift Package Manager | Не CocoaPods: его реестр закрывается на запись в декабре 2026 |

Версии уточнять командой `npm view <пакет> version` в момент установки и фиксировать в `package.json` точно (без `^`) для движка и Capacitor.

## 2. Структура проекта

```
tippy-treats/
├── CLAUDE.md
├── README.md
├── docs/
├── index.html
├── package.json
├── vite.config.ts
├── capacitor.config.ts
├── .env.example
├── assets/
│   ├── svg/            лица, иконки, элементы интерфейса, фоны
│   ├── fonts/          Nunito
│   ├── audio/          только если появится лицензированная музыка
│   └── LICENSES.md
├── ios/                создаётся Capacitor (этап M7)
├── android/            создаётся Capacitor (этап M9)
├── scripts/
│   └── sim.ts          бот-симуляция для баланса
└── src/
    ├── main.ts         точка входа: конфигурация Phaser, запуск сервисов
    ├── core/           ЧИСТАЯ ЛОГИКА. Без Phaser, Capacitor, DOM
    │   ├── rng.ts              генератор с зерном (mulberry32)
    │   ├── tower-sim.ts        симуляция забега
    │   ├── drop.ts             расчёт результата броска
    │   ├── wobble.ts           качка
    │   ├── scoring.ts          очки, комбо, монеты
    │   ├── zones.ts            правила зон, расписание событий по зерну
    │   ├── abilities/          по файлу на способность + registry.ts
    │   ├── run-result.ts       итог забега
    │   ├── progression.ts      опыт, уровень пекаря, награды
    │   ├── missions.ts         выбор и прогресс заданий
    │   ├── streak.ts           серия дней
    │   ├── daily.ts            башня дня: зерно, бригада, попытки
    │   ├── economy.ts          покупки за монеты/ягоды, прокачка
    │   └── save/
    │       ├── schema.ts       типы сохранения
    │       ├── migrations.ts
    │       └── defaults.ts
    ├── data/           ВСЕ ЧИСЛА И КОНТЕНТ
    │   ├── balance.ts
    │   ├── anim.ts
    │   ├── creatures.ts
    │   ├── zones.ts
    │   ├── missions.ts
    │   ├── rewards.ts          уровни пекаря, серия, башня дня
    │   └── products.ts         идентификаторы покупок
    ├── game/           ОТРИСОВКА (Phaser)
    │   ├── config.ts
    │   ├── scenes/
    │   │   ├── boot-scene.ts
    │   │   ├── preload-scene.ts
    │   │   ├── home-scene.ts
    │   │   ├── game-scene.ts
    │   │   ├── hud-scene.ts        интерфейс поверх забега
    │   │   ├── results-scene.ts
    │   │   ├── team-scene.ts
    │   │   ├── collection-scene.ts
    │   │   ├── creature-detail-scene.ts
    │   │   ├── shop-scene.ts
    │   │   ├── daily-scene.ts
    │   │   └── modal-scene.ts      окна: задания, серия, настройки, продолжение
    │   ├── objects/
    │   │   ├── layer-view.ts
    │   │   ├── creature-face.ts
    │   │   ├── tower-view.ts
    │   │   ├── flying-layer-view.ts
    │   │   ├── background.ts
    │   │   └── coin-view.ts
    │   ├── fx/                 частицы, кольца, конфетти, текст-всплывашки
    │   └── ui/                 кнопка, панель, счётчик, полоса прогресса, карточка
    ├── services/       ВНЕШНИЙ МИР (интерфейс + native + web-заглушка)
    │   ├── storage/
    │   ├── ads/
    │   ├── iap/
    │   ├── analytics/
    │   ├── haptics/
    │   ├── audio/
    │   ├── notifications/
    │   ├── consent/
    │   ├── share/
    │   └── index.ts            выбор реализации по платформе
    ├── state/
    │   └── game-state.ts       единственный владелец сохранения в памяти
    ├── i18n/
    │   ├── index.ts
    │   ├── en.json
    │   └── ru.json
    └── util/
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

## 4. Симуляция забега (`core/tower-sim.ts`)

Симуляция — машина состояний, которая ничего не знает об экране. Сцена вызывает `update` и `drop`, а в ответ получает **события**, по которым проигрывает анимации.

```ts
export interface RunConfig {
  seed: number;
  mode: 'classic' | 'daily';
  team: Array<{ id: CreatureId; level: number } | null>; // 3 slots
  tutorial: boolean;
  startHeight?: number; // debug: start with N perfect full-width layers already placed
}

export type SimPhase = 'flying' | 'falling' | 'pause' | 'await_continue' | 'over';

export interface FlyingLayer {
  index: number;               // 1-based number the layer will have in the tower
  x: number;                   // centre
  width: number;
  dir: 1 | -1;
  speed: number;
  kind: 'plain' | 'creature' | 'golden';
}

export interface PlacedLayer {
  x: number;                   // resting centre, wobble not included
  width: number;
  kind: 'plain' | 'creature' | 'golden';
  quality: 'perfect' | 'normal';
}

export interface TowerState {
  phase: SimPhase;
  phaseMs: number;             // time spent in the current phase (drives the fall animation)
  height: number;
  score: number;
  coins: number;
  berries: number;
  combo: number;
  bestCombo: number;
  wobble: number;              // 0..100
  wobblePhase: number;         // radians
  layers: PlacedLayer[];       // bottom → top
  flying: FlyingLayer | null;  // x, width, dir, speed, kind
  effects: ActiveEffect[];     // ability effects with remaining layers
  zoneIndex: number;
  continuesUsed: number;
  shield: number;              // remaining layers of Brownie shield, 0 = none
}

export type SimEvent =
  | { type: 'spawn'; layer: FlyingLayer }
  | { type: 'land'; quality: 'perfect' | 'normal'; dx: number; cutWidth: number; cutSide: 'left' | 'right' | null; newWidth: number }
  | { type: 'miss'; shielded: boolean }
  | { type: 'combo'; value: number; widened: number }
  | { type: 'wobble_sneeze'; newWidth: number }
  | { type: 'coin_spawn'; x: number }
  | { type: 'coin_collect'; amount: number }
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: unknown }
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };

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

Итог забега (`core/run-result.ts`):

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

Требования:
- `update` работает с фиксированным шагом 1/120 с (накопитель времени внутри), чтобы поведение не зависело от частоты кадров.
- Вся случайность берётся из `Rng`, созданного из `config.seed`. Отдельные потоки случайности для зон, монет и косметики, чтобы изменение одного не сдвигало другие: `rng.fork('zones')`, `rng.fork('coins')`.
- Косметическая случайность (разлёт частиц) живёт в сценах и может использовать `Math.random()`.
- Симуляция не знает о времени суток, сохранении и рекламе.

### Способности

```ts
// core/abilities/types.ts
export interface AbilityContext {
  state: TowerState;        // mutable inside sim
  level: number;            // 1..5
  boosted: boolean;         // perfect drop
  emit(e: SimEvent): void;
}

export interface Ability {
  id: string;
  onLand(ctx: AbilityContext): void;                 // when creature layer lands
  modifiers?(effect: ActiveEffect): Partial<Modifiers>; // while effect is active
}

export interface Modifiers {
  speedMult: number;
  scoreMult: number;
  coinMultAdd: number;      // additive, see creatures doc
  perfectTolerance: number; // overrides base when larger
  autoPerfect: boolean;
  guides: boolean;
  crumbToCoinsPx: number | null;
}
```

Симуляция перед каждым броском собирает итоговые `Modifiers` из активных эффектов и правил зоны. Новая способность добавляется файлом в `abilities/` и строкой в `registry.ts`.

## 5. Состояние и сохранение

`state/game-state.ts` — единственное место, где сохранение живёт в памяти и изменяется. Сцены вызывают методы (`gameState.buyCreature(id)`), а не правят объект напрямую. Каждое изменение помечает состояние «грязным»; запись на диск происходит с задержкой 500 мс и обязательно при сворачивании приложения.

```ts
// core/save/schema.ts
export interface SaveV1 {
  version: 1;
  installId: string;             // random uuid, for mission seed & support
  createdAt: number;             // epoch ms
  lastSeenAt: number;
  coins: number;
  berries: number;
  bakerLevel: number;
  bakerXp: number;
  creatures: Partial<Record<CreatureId, { level: number }>>;
  team: [CreatureId | null, CreatureId | null, CreatureId | null];
  records: { classicHeight: number; classicScore: number; bestCombo: number };
  stats: { runs: number; totalLayers: number; perfects: number; adsWatched: number };
  streak: { count: number; best: number; lastDay: string; cycle: number; claimedToday: boolean };
  missions: { day: string; items: MissionProgress[]; rerollUsed: boolean; chestClaimed: boolean };
  daily: { day: string; attemptsUsed: number; extraAttemptUsed: boolean; best: number; claimedTiers: number[] };
  gift: { nextAt: number };
  shop: { freeCoinsDay: string; freeCoinsUsed: number; starterPackUntil: number };
  purchases: { removeAds: boolean; starterPack: boolean };
  tutorial: { firstRunDone: boolean; hintsShown: string[] };
  settings: { music: boolean; sfx: boolean; haptics: boolean; reducedFx: boolean; lang: 'en' | 'ru' | 'auto';
              notifications: { gift: boolean; streak: boolean; daily: boolean; comeback: boolean } };
  ads: { lastInterstitialAt: number; runsSinceInterstitial: number; sessions: number };
  consent: { attAsked: boolean; notifAsked: boolean };
}
```

Правила:
- Даты дней хранятся строкой `YYYY-MM-DD`: местная для серии и заданий, UTC для башни дня.
- При загрузке: разбор JSON → проверка версии → цепочка миграций → заполнение недостающих полей значениями по умолчанию. Повреждённое сохранение не должно ломать запуск: при ошибке разбора сохраняется резервная копия под ключом `save_corrupt_<время>` и создаётся новое сохранение.
- Хранится две копии: `save` и `save_backup` (предыдущая успешная запись).
- Валюты никогда не уходят в минус: методы траты возвращают `false`, если не хватает.
- Покупки `removeAds` и `starterPack` при запуске сверяются с RevenueCat (источник истины — стор).

## 6. Масштабирование экрана

- Логическая ширина всегда **1080**. Логическая высота вычисляется по пропорциям экрана: `1080 × (высота / ширина)`, с ограничением от 1920 до 2520.
- Режим масштабирования Phaser: подгонка по ширине с изменяемой высотой. Перерасчёт при изменении размера окна.
- Игровое поле привязано к низу (поднос на фиксированном расстоянии от нижней безопасной зоны). Интерфейс привязан к верхней и нижней безопасным зонам.
- Отступы безопасных зон читаются из CSS-переменных `env(safe-area-inset-*)` и переводятся в логические пиксели.
- Плотность рендера: `min(devicePixelRatio, 3)`.

## 7. Сцены

- `game-scene` и `hud-scene` работают параллельно: забег и его интерфейс.
- `modal-scene` запускается поверх любой сцены и ставит нижнюю на паузу.
- Переходы между экранами идут через единый помощник `ui/transition.ts`, чтобы анимация переходов была одинаковой.
- Сцена забега в каждом кадре: `events = sim.update(dt)` → передать события в `TowerView` и `fx` → обновить камеру. По касанию: `events = sim.drop()`.
- Объекты слоёв, частиц и всплывающих текстов берутся из пулов.

## 8. Сервисы

Каждый сервис: файл `types.ts` с интерфейсом, `native.ts`, `web.ts`. Выбор в `services/index.ts` по `Capacitor.isNativePlatform()`. Заглушки для браузера:

| Сервис | Поведение заглушки в браузере |
|---|---|
| storage | `localStorage` |
| ads | Показывает серое окно «Реклама (тест)» на 2 секунды и возвращает успех. Параметр `?ads=fail` имитирует отсутствие рекламы |
| iap | Окно подтверждения «Купить (тест)?», покупка всегда успешна |
| analytics | Печатает события в консоль |
| haptics | `navigator.vibrate`, если есть |
| notifications | Печатает расписание в консоль |
| consent | Сразу возвращает «согласие получено» |
| share | Web Share API или скачивание картинки |

Детали нативных реализаций в `09-services-analytics.md`.

## 9. Отладка и инструменты баланса

Доступны только в сборке разработки (`import.meta.env.DEV`) через параметры адреса и клавиши:

| Инструмент | Как включить |
|---|---|
| Панель отладки (зерно, скорость, качка, активные эффекты, частота кадров) | `?debug=1` или клавиша `D` |
| Задать зерно | `?seed=12345` |
| Начать с высоты N | `?start=60` |
| Бот, играющий сам с заданной точностью | `?bot=45` (стандартное отклонение в мс) |
| Выдать валюту, открыть всех существ | кнопки в панели отладки |
| Сдвиг даты на N дней (проверка серии и заданий) | `?dayOffset=1` |
| Ускорение времени ×0,25…×4 | клавиши `[` и `]` |

**`npm run sim`** запускает `scripts/sim.ts`: без отрисовки проигрывает по 2000 забегов для каждого профиля игрока и набора бригад и печатает таблицу: медиана и 90-й перцентиль высоты, средние монеты, средняя длительность. Используется для проверки ожиданий из `02-gameplay.md`, раздел 12.

## 10. Тестирование

| Что | Как |
|---|---|
| `core/drop.ts` | Таблица случаев: идеально, обычный слева/справа, граница промаха, липучка, авто-идеал |
| `core/wobble.ts` | Рост, затухание, чих на 100, амплитуда по глубине |
| `core/tower-sim.ts` | Детерминизм: одно зерно и одна последовательность касаний дают одинаковый результат; сценарии продолжения и щита |
| `core/abilities/*` | Каждый уровень каждой способности, усиление, продление эффектов |
| `core/zones.ts` | Расписание событий одинаково для одного зерна |
| `core/streak.ts`, `missions.ts`, `daily.ts` | Смена дня, пропуск дня, перевод часов назад, UTC против местного времени |
| `core/economy.ts` | Нельзя уйти в минус, нельзя купить дважды, цены из данных |
| `core/save/migrations.ts` | Каждая миграция, повреждённый JSON, пустое сохранение |
| Данные | Тест целостности: у каждого существа есть ключи i18n, способность в реестре, способ получения; ключи en и ru совпадают |

Целевое покрытие `src/core`: ≥ 85% строк. Сцены юнит-тестами не покрываются; для них есть ручной чек-лист в дорожной карте и режим бота.

## 11. Локализация

- `i18n/en.json` и `ru.json` с одинаковым набором ключей. Вложенные ключи: `creature.honey.name`.
- Подстановки: `{value}`, `{n}`. Множественное число через `Intl.PluralRules` (в русском три формы: слой, слоя, слоёв).
- Язык по умолчанию определяется по системе; если не ru, используется en.

## 12. Журнал технических решений

Сюда Claude Code записывает решения, принятые при реализации и отличающиеся от этого документа.

| Дата | Решение | Причина |
|---|---|---|
| 2026-11-13 | TypeScript 5.9, а не актуальный 7.x | Раздел 1 требует 5.x; `typescript-eslint` 8 поддерживает TypeScript только до 6.0 |
| 2026-11-13 | Масштабирование: `Phaser.Scale.FIT` + `CENTER_BOTH`, логическая высота пересчитывается через `scale.setGameSize(1080, h)` при изменении размера контейнера (`ResizeObserver`). Расчёт высоты вынесен в `util/logical-size.ts` | В Phaser 4 нет готового режима «ширина фиксирована, высота по экрану с ограничением». Если пропорции экрана выходят за 1920–2520, появляются поля по бокам или сверху и снизу |
| 2026-11-13 | Отдельного множителя плотности `min(devicePixelRatio, 3)` нет: холст всегда 1080 логических пикселей в ширину | В Phaser 4 нет параметра `resolution`. На телефонах шириной 360–430 пт холст 1080 уже даёт плотность 2,5–3. Вернуться к вопросу на M7 при проверке на устройстве |
| 2026-11-13 | Nunito лежит вариативными файлами woff2 (latin, latin-ext, cyrillic, cyrillic-ext), подключён через `@font-face` в `src/style.css`; `main.ts` ждёт `document.fonts.load` до создания игры | Один файл на набор символов покрывает ExtraBold и Black; текст Phaser не мигает системным шрифтом при старте |
| 2026-11-13 | Отступы безопасных зон (раздел 6) пока не читаются | В браузере они нулевые; задача стоит в M7 |
| 2026-11-13 | Юнит-тесты допускаются и в `src/util` | Там лежат чистые функции (расчёт логического размера) |
| 2026-11-13 | Размеры логического экрана лежат в `data/screen.ts`, а не в `game/config.ts` | Центр подноса (540) нужен ядру, а `core` не может импортировать `game` |
| 2026-11-13 | `npm run sim` запускается через `tsx` (dev-зависимость) | Vitest 5 больше не приносит `vite-node`, а встроенный запуск TypeScript в Node требует расширений `.ts` в импортах |
| 2026-11-13 | `Modifiers`, `ActiveEffect` и `CreatureId` уже лежат в `core/abilities/types.ts`; `CreatureId` пока `string` | Точка расширения для M4: симуляция собирает модификаторы перед броском, сейчас возвращаются базовые |
| 2026-11-13 | В M1 симуляция не реализует щит (`shield` всегда 0, `miss.shielded` всегда `false`), обучение (`RunConfig.tutorial` не читается), зоны и монеты | Щит появляется с Брауни (M4), остальное в M5. Поля состояния и типы событий уже заведены |
| 2026-11-13 | Покрытие считает `@vitest/coverage-v8`, команда `npm run coverage`, порог 85% строк по `src/core` | Критерий готовности M1 |
| 2026-11-13 | В M2 лица, фоны, поднос, слои и кнопки собираются кодом через `Graphics.generateTexture` (`ui/bake-texture.ts`), а не SVG-файлами из `assets/svg/`. Ключи текстур: `face_eye`, `face_mouth_smile`, `layer_<цвет>_<ширина>` и т. п. | Графика из кода по-прежнему соответствует правилу «рисуется кодом и SVG»; перенос в SVG и ключи вида `face_eye_open` откладываются до M3, где появляются формы рта, моргание и реакции |
| 2026-11-13 | Арт слоя запекается один раз на пару «цвет, целая ширина» и показывается как `Image`; неиспользуемые текстуры хранятся до `ANIM.pool.idleLayerTextures`, старейшие удаляются. Статичные элементы (поднос, кнопки, шкала качки) тоже запечены | Phaser 4 каждый кадр заново триангулирует команды `Graphics`: 16 слоёв из векторов съедали кадр на слабых телефонах |
| 2026-11-13 | Слои ниже нижнего края экрана возвращаются в пул (`TowerView.sync` получает нижнюю границу камеры), `maxLiveLayers` остаётся верхним пределом | Phaser 4 не отсекает объекты вне камеры; раздел 9 документа 06 требует пул для слоёв под экраном |
| 2026-11-13 | Камера держит летящий слой целиком (с покачиванием) ниже нижней границы HUD плюс `ANIM.camera.hudClearance`; граница HUD лежит в `data/hud-layout.ts` (`HUD_LAYOUT.bottomEdge`) и общая для `hud-scene` и `game-scene` | На низких экранах летящий слой заходил под шкалу качки |
| 2026-11-13 | Тень-подсказка рисуется тёмной полосой на верхнем слое башни, по ширине летящего слоя, обрезанной по верхнему слою | Раздел 4 документа 06: «на верхнем слое башни видна тень летящего слоя» |
| 2026-11-13 | Пауза в M2: «Продолжить» (с отсчётом 3-2-1) и «Заново». Кнопка «Домой» и переключатели звука появятся вместе с Home (M6) и звуком (M3) | Home и звука ещё нет |
| 2026-11-13 | Числа HUD форматируются `formatNumber` из `i18n` (разделитель берётся из `Intl`, группировка всегда включена, в том числе для четырёх цифр в ru). Язык по умолчанию определяется по первой (системной) локали | Раздел 7: `1 250` для ru и `1,250` для en; раздел 11: язык следует системному |
| 2026-11-13 | Бот не тапает позже первого отскока от стены после прохода цели | Большая поздняя ошибка иначе оставляла слой летать вечно |
