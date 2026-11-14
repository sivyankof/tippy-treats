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
    │   ├── tower-sim.ts        симуляция забега (машина состояний)
    │   ├── sim-types.ts        типы состояния, событий и конфигурации забега
    │   ├── miss.ts             промах: щит, окно продолжения или конец забега
    │   ├── run-coins.ts        монеты забега: начисление и события выплат
    │   ├── coins.ts            чистые правила монет (парящая монета, комбо, бонус высоты)
    │   ├── team-queue.ts       расписание существ бригады, «следующее существо»
    │   ├── bot.ts              бот игрока для симуляции
    │   ├── drop.ts             расчёт результата броска
    │   ├── wobble.ts           качка
    │   ├── scoring.ts          очки, комбо, монеты
    │   ├── zones.ts            правила зон, расписание событий по зерну
    │   ├── flight.ts           движение летящего слоя: стены, правила зон, ожидание, обманка, облака
    │   ├── abilities/          по файлу на способность + registry.ts
    │   ├── run-result.ts       итог забега
    │   ├── progression.ts      опыт, уровень пекаря, награды
    │   ├── missions.ts         выбор и прогресс заданий
    │   ├── streak.ts           серия дней
    │   ├── daily.ts            башня дня: зерно, бригада, попытки
    │   ├── continue-offer.ts   что показывает окно «Продолжить?» (или ничего)
    │   ├── berries.ts          ягоды забега: `berriesFromEvents`
    │   ├── economy.ts          кошелёк, покупки, прокачка, обмен ягод (`spend`, `buyCreature`, `upgradeCreature`, `exchangeBerries`)
    │   └── save/
    │       ├── schema.ts       типы сохранения, `HINT_IDS`
    │       ├── migrations.ts   цепочка миграций (`migrate`, цепочку можно подменить в тесте)
    │       ├── defaults.ts     новое сохранение
    │       ├── load.ts         `loadSave` (основное, копия, новое), нормализация, `serializeSave`
    │       └── save.test.ts
    ├── data/           ВСЕ ЧИСЛА И КОНТЕНТ
    │   ├── balance.ts
    │   ├── anim.ts
    │   ├── ability-anim.ts     числа и цвета анимаций способностей
    │   ├── creature-looks.ts   рецепты рисунка и лица каждого существа
    │   ├── creature-materials.ts материал существа: приземление, колыхание, покой, частицы
    │   ├── creatures.ts
    │   ├── zones.ts            зоны и числа правил
    │   ├── backdrop.ts, backdrop-colors.ts, backdrop-life.ts   фоны зон: слои, цвета неба и картинок, числа фоновой жизни
    │   ├── zone-plate.ts      плашка зоны
    │   ├── treasure-anim.ts    монеты, ягоды, счётчики, золотой слой
    │   ├── rule-anim.ts        визуал правил зон: контур рывка, полосы скорости, облако, обманка
    │   ├── continue-anim.ts    замедление промаха, окно «Продолжить?», флажок рекорда
    │   ├── tutorial-anim.ts    вид и время подсказок обучения
    │   ├── rewarded-video.ts   вид и время браузерной заглушки рекламы
    │   ├── idle-motion.ts      тихое покачивание объектов экрана (правило «нет неподвижных объектов»)
    │   ├── hud-layout.ts       раскладка HUD, плашка шкалы качки
    │   ├── progression.ts      XP за уровень, награды уровней
    │   ├── economy.ts          цены прокачки, пакеты обмена ягод
    │   ├── save-defaults.ts    начальное состояние нового сохранения
    │   ├── storage.ts          ключи хранилища, задержка записи (500 мс)
    │   ├── clock.ts            допуск перевода часов, миллисекунд в сутках
    │   ├── missions.ts
    │   ├── rewards.ts          уровни пекаря, серия, башня дня
    │   └── products.ts         идентификаторы покупок
    ├── game/           ОТРИСОВКА (Phaser)
    │   ├── config.ts
    │   ├── camera-layout.ts    математика прокрутки камеры (trayScrollY, targetScrollY, FLYING_REACH), с тестами
    │   ├── continue-flow.ts    ход после промаха: окно, реклама, оплата, отказ (сцены только показывают)
    │   ├── apply-settings.ts   сохранённые настройки в сервисы и режим эффектов; выключатели окна паузы
    │   ├── tutorial/           обучение: `tutorial-director.ts` (когда что показывать), `timeline.ts`, подсказки
    │   │                       `tap-hint.ts`, `perfect-hint.ts`, `caption-hint.ts`, `tutorial-hints.ts`, `hint-textures.ts`
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
    │   │   ├── layer-view.ts       слой: картинка, лицо, анимации
    │   │   ├── layer-art-slot.ts   кэш запечённой картинки слоя (вынесен из layer-view.ts)
    │   │   ├── layer-rig.ts        вспышка, прыжок, прозрачность, разрез «Двойняшек»
    │   │   ├── layer-material.ts   материал существа на слое (форма из material-shape.ts)
    │   │   ├── layer-face.ts, face-*.ts   лицо: части, состояние, рецепт
    │   │   ├── creature-art/       12 рисовальщиков существ (baked, creamy, layered)
    │   │   ├── tower-view.ts
    │   │   ├── sway-hold.ts        «замороженная» качка при чихе
    │   │   ├── flying-layer-view.ts
    │   │   ├── floating-coin.ts    парящая монета на строке посадки
    │   │   ├── tray.ts             поднос (класс Tray: покой и блик)
    │   │   ├── backdrop/           фоны зон: `backdrop.ts` (контроллер, кросс-фейд, прилавок), `zone-scenery.ts`
    │   │   │                       (одна зона), по файлу на зону (`kitchen-zone.ts` … `space-zone.ts`), `life.ts`
    │   │   │                       (Hover, PuffColumn, Traveler, Twinkles), `life-motion.ts`, `pass-timer.ts`,
    │   │   │                       `sky-gradient.ts`, `zone-fade.ts`, `worktop.ts` (кухонный прилавок)
    │   │   └── coin-view.ts
    │   ├── fx/                 частицы, кольца, конфетти, текст-всплывашки, осколки (debris-fx.ts), частицы материалов (material-fx.ts)
    │   │   │                   монеты и золотой слой (`coin-fx.ts`, `coin-flight-math.ts`, `golden-fx.ts`), визуал правил зон
    │   │   │                   (`flying-fx.ts`, `rule-fx.ts`, `rush-outline.ts`, `speed-streaks.ts`, `cloud-cover.ts`, `rule-state.ts`)
    │   │   │                   `spring-back.ts` (пружинный твин масштаба, вынесен из layer-view.ts), `record-moment.ts` (линия и флажок рекорда,
    │   │   │                   конфетти), замедление промаха (`timeScale`) в `run-fx.ts`
    │   │   └── abilities/          анимации способностей: фирменные (по файлу на существо) и «пока действует»
    │   ├── debug/              панель отладки, выбор бригады, сцена `?lineup=1`, проверка неподвижных объектов
    │   │                       `idle-audit.ts` + `still-watch.ts` (только сборка разработки)
    │   └── ui/                 кнопка, панель, счётчик, полоса прогресса, карточка; счётчики монет и ягод
    │                           (`resource-tally.ts`, `treasure-hud.ts`, `treasure-flights.ts`), плашка зоны (`zone-plate.ts`),
    │                           плашка шкалы качки (`bar-plate.ts`), покачивание HUD (`idle-motion.ts`, `hud-idle.ts`),
    │                           окно «Продолжить?»: `continue-window.ts`, `continue-timer.ts`, `continue-buttons.ts`
    ├── services/       ВНЕШНИЙ МИР (интерфейс + native + web-заглушка)
    │   ├── storage/            `types.ts` (`StorageService`), `web.ts` (localStorage, при сбое память страницы), `memory.ts`
    │   ├── rewarded-video/     реклама: `types.ts`, `web.ts` (заглушка; нативная появится в M7)
    │   ├── iap/
    │   ├── telemetry/          аналитика
    │   ├── haptics/
    │   ├── audio/
    │   ├── notifications/
    │   ├── consent/
    │   ├── share/
    │   └── index.ts            выбор реализации по платформе
    ├── state/
    │   ├── game-state.ts       единственный владелец сохранения в памяти (класс `GameState`, зависимости внедряются)
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

export type LayerKind = 'plain' | 'creature' | 'golden';

export interface LayerPlan {   // what a layer is, decided at spawn (core/team-queue.ts)
  kind: LayerKind;
  creature?: CreatureId;       // only for kind 'creature'
  level?: number;              // team slot level, clamped to 1..5
}

export interface FlyingLayer extends LayerPlan {
  index: number;               // 1-based number the layer will have in the tower
  x: number;                   // centre
  width: number;
  dir: 1 | -1;
  speed: number;               // nominal px/s: base × zone mult (capped in Space) × ability mult
  zoneIndex: number;           // index into ZONES (data/zones.ts)
  rule: LayerRuleKind;         // 'none' | 'showcase' | 'roof' | 'clouds' | 'stars'
  rush: boolean;               // showcase rush: holds still for the wind-up, then ×1.35
  windupMs: number;            // wind-up left, the layer does not move while > 0
  stopMs: number;              // fake-out stop left; the layer reverses when it reaches 0
  coverMs: number;             // cloud cover left, the layer is hidden while > 0
  pass: number;                // 1-based pass across the screen (+1 at every wall bounce)
}
// flyingSpeed(layer) in core/flight.ts is the speed right now: 0 while windupMs or stopMs > 0,
// otherwise speed × (rush ? 1.35 : 1) × (rule === 'roof' ? roof profile at x : 1)

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
}

export type SimEvent =
  | { type: 'spawn'; layer: FlyingLayer }
  | { type: 'land'; quality: 'perfect' | 'normal'; dx: number; cutWidth: number; cutSide: 'left' | 'right' | null; newWidth: number }
  | { type: 'miss'; shielded: boolean }
  | { type: 'combo'; value: number; widened: number }
  | { type: 'wobble_sneeze'; newWidth: number }
  | { type: 'coin_spawn'; x: number }
  | { type: 'coin_collect'; amount: number; source: CoinSource }
  | { type: 'ability'; creature: CreatureId; boosted: boolean; payload: AbilityPayload }
  | { type: 'effect_end'; effect: string }
  | { type: 'zone_change'; zoneIndex: number }   // at the spawn of the first layer of a new zone
  | { type: 'cloud'; coverMs: number; pass: number }   // a cloud starts covering the layer
  | { type: 'fakeout'; x: number; stopMs: number }     // the layer stops, then reverses
  | { type: 'golden'; perfect: boolean }
  | { type: 'run_over'; result: RunResult };

export type CoinSource = 'floating' | 'combo' | 'perfect' | 'crumb' | 'golden' | 'height';

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
- Зона слоя считается по его индексу: `min(5, floor((i − 1) / 20))`. `state.zoneIndex` обновляется при появлении слоя, `zone_change` приходит один раз перед `spawn` первого слоя новой зоны (слои 21, 41, 61, 81, 101); повтор того же индекса (щит, продолжение) событие не повторяет. Отладочный `startHeight` ставит `zoneIndex` сразу по `startHeight + 1`, без события.
- Правила зон выбираются по индексу слоя, а не по ходу игры: `rng.fork('zones')` и под-потоки `fork('layer:<индекс>')` (рывок, обманка, сторона, правило Космоса) и `fork('cloud:<проход>')` внутри него. Поэтому расписание зависит только от зерна и индекса: повтор слоя, пропуск индексов двойняшками и действия игрока ничего не сдвигают. Парящая монета бросается так же, из `coins.fork('layer:<индекс>')`. Чистое API лежит в `core/zones.ts` (`zoneIndexOf`, `layerRules`, `rushIndices`, `cloudRoll`, `nominalSpeed`).
- Движение летящего слоя (стены, профиль «Крыши», ожидание рывка, остановка и разворот обманки, счёт проходов, укрытие облаком) живёт в `core/flight.ts`; `TowerSim` остаётся машиной состояний и вызывает `Flight.step` на каждом шаге. Скорость в данный момент даёт `flyingSpeed(layer)`: 0 во время ожидания рывка и остановки обманки, иначе номинальная `speed`, умноженная на 1,35 у рывка и на профиль у «Крыши». Бот и сцена берут скорость только оттуда.
- Множители зоны не входят в `Modifiers`: номинальная скорость слоя считается как `min(потолок зоны, layerSpeed(высота, 1) × множитель зоны) × speedMult способностей`, потому что потолок 1400 в Космосе действует на «базу × зону», а способности («Морозко», «Лимонка») и рывок умножают поверх него. Множитель очков зоны умножается на `scoreMult` способностей при начислении очков слоя (зона берётся по летящему слою); плоский бонус золотого слоя не умножается.
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
}

export interface Modifiers {
  speedMult: number;
  scoreMult: number;
  coinMultAdd: number;      // additive, see creatures doc
  perfectTolerance: number; // overrides base when larger
  autoPerfect: boolean;
  guides: boolean;
  crumbToCoinsPx: number | null;
  perfectCoinAdd: number;   // lemon: coins per perfect drop, summed, not multiplied
}
```

Симуляция перед каждым броском собирает итоговые `Modifiers` из активных эффектов. Множители зоны (скорость, очки) в `Modifiers` не входят и применяются отдельно, потому что потолок скорости Космоса действует до множителя способностей (см. раздел 4 и журнал решений). Новая способность добавляется файлом в `abilities/` и строкой в `registry.ts`.

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
  settings: { music: boolean; sfx: boolean; haptics: boolean; reducedFx: 'auto' | 'on' | 'off'; lang: 'en' | 'ru' | 'auto';
              notifications: { gift: boolean; streak: boolean; daily: boolean; comeback: boolean } };
  ads: { lastInterstitialAt: number; runsSinceInterstitial: number; sessions: number };
  consent: { attAsked: boolean; notifAsked: boolean };
}

interface MissionProgress { id: string; group: 'easy' | 'medium' | 'hard'; target: number; progress: number; claimed: boolean }
```

`hintsShown` хранит id подсказок: `tutorial` (вступление «Медка» сыграло), `tap`, `firstPerfect`, `honey`, `wobble`, `berry`. `reducedFx`: `auto` (игрок не выбирал, решают система и автоматическое переключение), `on`, `off` (выбор игрока важнее системного «Уменьшения движения» и автомата).

Правила:
- Даты дней хранятся строкой `YYYY-MM-DD`: местная для серии и заданий, UTC для башни дня.
- При загрузке: разбор JSON → проверка версии → цепочка миграций → нормализация (недостающие поля берутся из значений по умолчанию). Порядок источников: `save` → `save_backup` → новое сохранение. Текст, который не удалось прочитать, сохраняется под ключом `save_corrupt_<время>`. Сохранение более новой версии считается непригодным и тоже остаётся как `save_corrupt_*`. Загрузка никогда не бросает исключение и не блокирует запуск при сбое хранилища. Если `save` текущей версии разобрался, но в нём нет или неверного типа ключевых полей (`coins`, `berries`, `bakerLevel`, `bakerXp`, `creatures`, `records`, `stats`), он считается повреждённым: при целой копии `save_backup` берётся копия, а поломанный `save` остаётся как `save_corrupt_*`; без целой копии `save` чинится поле за полем, как раньше. Если непригодны оба текста, под ключами сохраняются оба: `save_corrupt_<время>` и `save_corrupt_<время>_backup`.
- Ожидание загрузки ограничено: `gameState.load({ timeoutMs })` (`main.ts` передаёт `BOOT.saveWaitMs`, 2 с) возвращает `{ status: 'loaded', source, ... }`, `{ status: 'timeout' }` или `{ status: 'read_failed' }`. `read_failed` значит, что `storage.get` бросил исключение или отклонён (это не то же самое, что «ключа нет»: пустой ключ даёт новое сохранение). При `timeout` и `read_failed` игра идёт на новом сохранении в памяти, и в хранилище в эту загрузку страницы ничего не пишется (`flush` и отложенная запись отключены), иначе незаконченное чтение могло бы затереть настоящее сохранение. Поздний результат чтения (и запись `save_corrupt_*`) отбрасывается, состояние посреди игры не подменяется, в консоль выводится предупреждение. Прогресс такой сессии не сохраняется.
- Нормализация: числа целые и неотрицательные; уровни существ 1..5; команда состоит из существ, которыми игрок владеет (иначе `null`), без повторов; неизвестные существа отбрасываются; дни `YYYY-MM-DD` или пустая строка; стартовые существа (`SAVE_DEFAULTS.startCreatures`) всегда во владении, а пустая команда получает первое из них в слот 0; `bakerLevel` не выше `MAX_BAKER_LEVEL`, `bakerXp` меньше порога следующего уровня (иначе подделанное число зависило бы первый же забег на миллионах повышений).
- Хранится две копии: `save` и `save_backup` (предыдущая успешная запись). Запись: через 500 мс после первого изменения серии (`SAVE_WRITE_DEBOUNCE_MS`), сразу при `visibilitychange: hidden` и `pagehide`. Если запись не удалась, состояние остаётся «грязным» и повтор назначается не раньше чем через `SAVE_RETRY_MS` (5 с). `lastSeenAt` и проверка «часы переведены назад» идут по настоящим системным часам (`realNow`), а не по часам со сдвигом `?dayOffset=`, иначе после dev-запуска со сдвигом обычный запуск считал бы часы отставшими.
- Валюты никогда не уходят в минус: `core/economy.ts` `spend` возвращает новый кошелёк или `null` (отрицательная и нечисловая цена отклоняются, дробная округляется вверх; `earn` берёт только целые неотрицательные суммы); `gameState.spend/spendBerries` возвращают `false`. Покупки и прокачка возвращают `{ ok: true, value } | { ok: false, reason }` (тип `EconomyResult`).
- Монеты забега попадают в сохранение, когда забег кончился (при любом исходе, `gameState.recordRun`); ягоды сразу, как только заработаны (`addBerries`), поэтому `recordRun` их не прибавляет. Если игрок уходит из идущего забега (кнопка «Заново» в паузе, перезапуск из панели отладки, любой другой выход со сцены забега), сцена закрывает забег сама: `TowerSim.quitResult()` собирает `RunResult` с `endReason: 'quit'` из текущего состояния (забег не меняется), `game/run-recorder.ts` (`RunRecorder`) записывает его через `recordRun` ровно один раз. Закрытие или перезагрузка страницы посреди забега (`pagehide`) тоже считается выходом из него: сцена забега подписывается в `create` (`state/page-lifecycle.ts`, `bindPageLeave`), записывает забег через `RunRecorder` и сразу сбрасывает сохранение на диск, отписывается на `SHUTDOWN`. Уход в фон (`visibilitychange: hidden`) выходом не считается, это пауза. Если после такого `pagehide` страница вернулась из кэша «назад/вперёд» (`pageshow` с `persisted`), старый забег уже записан, поэтому сцена начинает новый (`launchRun`): монеты не считаются дважды и не теряются. Забег, который уже кончился и записан, повторно не записывается. Бонус за высоту (`payHeightBonus`) платится только когда забег заканчивается сам, у `quit` его нет. Забег, в котором ничего не заработано (высота не выше стартовой, ноль очков, монет и ягод), забегом не считается (`isEmptyRun`): сохранять нечего, а счётчик забегов не должен расти от повторных «Заново». Первый забег игрока за всё время рекордом не бывает, дальше сравнение с сохранённым лучшим результатом.
- Отладочные подмены (`?tutorial=`, `?team=`, `?dayOffset=`) действуют до перезагрузки страницы и не сохраняются. Забеги с `?bot=` и `?start=` искусственные и в сохранение не пишутся вообще (ни монеты, ни ягоды, ни XP: `RunRecorder` выключен, решает `savesRun` в `util/debug-params.ts`); забеги с `?team=` и `?level=` пишутся как обычные, чтобы владелец проверял существ по-настоящему.
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
| ads | `services/rewarded-video/web.ts`: серый экран (DOM) на 2 секунды, затем `rewarded`. Режимы `reward` / `dismissed` / `unavailable` переключаются кнопкой в панели отладки (`adsDev`, не входит в `Services`) |
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
| Панель отладки (частота кадров, зерно, скорость летящего слоя, качка, высота, фаза, бригада, режим «меньше эффектов») | `?debug=1` или клавиша `D` |
| Задать зерно | `?seed=12345` |
| Начать с высоты N | `?start=60` |
| Бот, играющий сам с заданной точностью | `?bot=45` (стандартное отклонение в мс) |
| Бригада забега (временно, до экрана «Команда» в M6) | `?team=honey,jelly,brownie` (до 3 id через запятую, пусто или `-` — пустой слот, неизвестные id игнорируются) и `?level=N` (1..5, по умолчанию 3); в панели отладки три слота (касание листает: пусто, затем каждое из 12 существ), уровень и кнопка `restart`, которая начинает новый забег с выбранной бригадой |
| Выдать валюту, открыть всех существ | кнопки в панели отладки; сейчас есть кнопка «+50 berries» (пишет в сохранение) |
| Режим рекламы-заглушки | кнопка `ads reward/dismissed/unavailable` в панели отладки: касание переключает ответ следующей рекламы |
| Обучение | `?tutorial=1` принудительно делает забег обучающим со свежими флагами, `?tutorial=0` отключает все подсказки. Без `?tutorial` любой из `?team`, `?level`, `?bot`, `?start` даёт обычный забег (без подсказок, флаги не трогаются). **Внимание:** без `?tutorial=0` и без этих параметров первый забег после загрузки страницы всегда обучающий (скорость ×0,6, подсказки, «Медок»), что искажает ручную проверку баланса. При `?bot` окно «Продолжить?» не открывается. Забеги с `?bot` и `?start` в сохранение не пишутся |
| Сдвиг даты на N дней (проверка серии и заданий) | `?dayOffset=N`, целое от -3650 до 3650; применяет `util/clock.ts` (`now()`), других источников времени в коде нет. Исключение: `lastSeenAt` и проверка «часы назад» берут `realNow()` без сдвига |
| Новое сохранение | `?reset=1` (только сборка разработки): запуск с чистого сохранения, старое перезаписывается. После применения параметр убирается из адресной строки (`history.replaceState`), поэтому перезагрузка страницы или полная перезагрузка Vite не обнуляют сохранение снова |
| Ускорение времени ×0,25…×4 | клавиши `[` и `]` |
| Проверка «нет неподвижных объектов» (раздел 10 документа 06) | В консоли браузера `await tippyIdleAudit(6)`: за 6 секунд (параметр) следит за всеми видимыми объектами сцен забега и HUD и возвращает отчёт `{ seconds, frames, objectsChecked, limitMs, still[], groups[] }`, таблицу групп печатает в консоль. Объект неподвижен, если не менялись он сам и все его родительские контейнеры (поза, масштаб, угол, прозрачность, оттенок, кадр, текст, сдвиг тайла) дольше `limitMs` (2 с); медленный дрейф считается движением. Объекты без `getBounds` (Graphics) попадают в отчёт с флагом `boundsUnknown`. Подключается динамическим импортом только в сборке разработки |
| Строй из 12 существ (временный инструмент проверки рисунка M4, убрать после утверждения внешнего вида) | `?lineup=1`: вместо забега сцена `LineupScene` показывает башню из 12 слоёв-существ разной ширины со срезами слева и по одному целому слою справа; настройки в `data/lineup.ts` |

**`npm run sim`** запускает `scripts/sim.ts`: без отрисовки проигрывает по 2000 забегов для каждого профиля игрока и набора бригад и печатает таблицу: медиана и 90-й перцентиль высоты, средние монеты, средняя длительность. Используется для проверки ожиданий из `02-gameplay.md`, раздел 12.

Флаг `--all-teams` берёт за полные бригады все 220 сочетаний по три существа (порядок слотов как в `CREATURE_IDS`): обычная таблица по профилям (без бригады, одиночки, именные бригады) остаётся, а вместо 220 строк по каждому профилю печатаются сводка (5 лучших по медиане и по монетам, число бригад в диапазонах +30..+50% и свыше +50%, бригады свыше +50% с «Радужкой», без неё но с «Безешкой», и без обеих), строка «jelly solo» и итоговые критерии приёмки (одиночная «Желейка» на обычном профиле +8..+14%, нет доминирующей бригады, нет бригад свыше +50% без «Радужки» и «Безешки»). «Свыше +50%» везде считается с допуском владельца 3 процентных пункта: бригада попадает в эти списки и проваливает критерий, только если её прирост больше +53%; число бригад «в +30..+50%» считается без допуска. Проверка доминирования считается по 220 бригадам только с этим флагом. Без него шесть именных бригад для неё слишком малая выборка: `npm run sim` не выносит вердикт «FAIL» и не пишет «balance needs changes» по ним, а для каждого профиля печатает «dominance: not checked, the check needs --all-teams», итоговая строка гласит «verdict: the dominance check needs --all-teams». Строка об именных бригадах в диапазоне +30..+50% к медиане (справочная) остаётся. В таблице есть колонка `median zone`: зона, в которой закончился медианный забег.

В конце `npm run sim` печатает статистику качки по профилям без бригады (`scripts/wobble-stats.ts`): средняя и медианная качка в момент касания, доля касаний при качке выше 40 и выше 70, средняя амплитуда верхушки в пикселях, доля касаний с амплитудой больше допуска «идеально», число чихов за забег. Первый слой, который падает на поднос, не считается.

После неё ещё две таблицы по профилям без бригады (`scripts/end-stats.ts`): в какой зоне закончились забеги (% забегов) и какое правило действовало на слое, на котором забег проигран: «kitchen», «showcase side» (Витрина без рывка), «rush», «roof», «cloud at tap» (облако закрывало слой в момент касания бота), «clouds clear» (слой зоны Облаков, не закрытый в момент касания), «fake-out» (обманка этого слоя сработала), «stars no fake-out», «sneeze» (забег кончился чихом). Слои Космоса считаются по выпавшему правилу. Наблюдатели статистики подключаются к бот-забегу через `scripts/run-observer.ts` и на результат не влияют.

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
| `core/save/*` (`save.test.ts`) | Каждая миграция (цепочка подменяется в тесте), повреждённый JSON, пустое сохранение, будущая версия, нормализация |
| `core/progression.ts`, `util/clock.ts` | Уровни и награды; дни по местному и UTC времени, `clockWentBack`, `?dayOffset` |
| `state/game-state.ts` | Загрузка (новое, основное, копия, повреждённое), задержка записи и ротация копии, запись при сворачивании, правило рекорда, монеты в конце забега, ягоды сразу, баланс не уходит в минус, подсказки и настройки между запусками, награды уровней (хранилище, часы и таймеры подставляются) |
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
| 2026-11-13 | В M2 фоны, поднос, слои и кнопки собираются кодом через `Graphics.generateTexture` (`ui/bake-texture.ts`), а не SVG-файлами из `assets/svg/`. Лица в M2 тоже рисовались кодом; в M3 они переехали в SVG (см. строку ниже) | Графика из кода по-прежнему соответствует правилу «рисуется кодом и SVG» |
| 2026-11-13 | Арт слоя запекается один раз на тройку «цвет, целая ширина, сторона среза» и показывается как `Image`; ключ `layer_<цвет>_<ширина>_<n\|l\|r>` (`n` без среза, `l`/`r` срез слева/справа, на срезе рисуется губчатая полоса). Неиспользуемые текстуры хранятся до `ANIM.pool.idleLayerTextures`, старейшие удаляются. Статичные элементы (поднос, кнопки, шкала качки) тоже запечены | Phaser 4 каждый кадр заново триангулирует команды `Graphics`: 16 слоёв из векторов съедали кадр на слабых телефонах |
| 2026-11-13 | Части лица (глаза, зрачок, брови, рты, щёки, капля пота) лежат в `assets/svg/face_*.svg`, ключи текстур совпадают с именами файлов (`face_eye_open`, `face_mouth_smile` и т. д.); загрузка идёт в `preload` загрузочной сцены через `loadFaceTextures` (`objects/face-textures.ts`). Исходники SVG подключаются как текст (`import.meta.glob(..., { query: '?raw' })`) и отдаются загрузчику Phaser как blob-URL, которые отзываются после загрузки | Vite встраивает маленькие файлы в бандл как data-URI, а загрузчик Phaser `load.svg` такие адреса не читает; текст плюс blob-URL работает одинаково в dev и в сборке |
| 2026-11-13 | Слои башни получают глубину `DEPTH.tower + индекс * DEPTH.towerLayerStep` при взятии из пула, порядок отрисовки не зависит от порядка создания | Во время обвала виды берутся для нижних индексов уже после верхних, и `bringToTop` рисовал нижний слой поверх верхнего |
| 2026-11-13 | Живых обломков не больше `ANIM.pool.maxLivePieces`: при нехватке самый старый уходит первым, а вернувшийся в пул обломок отдаёт текстуру арта (`LayerView.releaseArt`). Пул обломков и капель общий: `fx/timed-pool.ts` | Обвал башни в 100 слоёв иначе держал бы 60–90 живых слоёв с лицами и перезапекал бы текстуры глубоких слоёв, оставляя их закреплёнными до конца забега |
| 2026-11-13 | Лицо собирается из состояния: настроение от качки (`calm` / `nervous` > 40 / `scared` > 70), подсказка рта и короткие реакции с приоритетом `blink < joy < ouch < squint < horror` (`objects/face-state.ts`, чистый модуль). Летящий слой показывает `open` у центра цели и `o` у края, верхний слой башни в этот момент `yum`. Простые слои показывают брови только в реакциях «ой» и «ужас» | Раздел 3 документа 06 отводит брови существам, а раздел 4 требует «брови домиком» у простого слоя при откусывании |
| 2026-11-13 | Чистые помощники отрисовки (`face-state`, `fx/anim-curves`, `fx/timed-pool`, `fx/camera-kick`) лежат в `src/game` без импорта Phaser и покрыты тестами Vitest | Логика таймеров и кривых анимации тестируется так же, как ядро; в порог покрытия `src/core` они не входят |
| 2026-11-13 | Промах в M3 идёт без замедления времени и без окна «Продолжить?»: сцена ждёт `ANIM.miss.fallMs + reactMs` (после чиха только `reactMs`), вызывает `decline()`, проигрывает обвал и показывает результаты через `ANIM.results.delayMs`. Порядок событий и анимаций держит `fx/run-fx.ts` | Замедление и окно продолжения стоят в M5 (заменено в M5, см. ниже: `ANIM.miss.fallMs` удалён, замедление и окно работают) |
| 2026-11-13 | «Замирание» башни при чихе только визуальное: `TowerView.freeze` держит прежние смещения качки `ANIM.sneeze.freezeMs` и плавно возвращается к живой качке, симуляция не останавливается | Остановка симуляции изменила бы правила игры; в фазе паузы после приземления прицеливания нет, поэтому расхождение незаметно |
| 2026-11-13 | Толчок камеры при приземлении — собственная кривая `sin(πt)` (`fx/camera-kick.ts`), а не `camera.shake` | `shake` трясёт случайно во все стороны, а раздел 4 требует толчок вниз и подскок вверх при «идеально» |
| 2026-11-13 | Слои ниже нижнего края экрана возвращаются в пул (`TowerView.sync` получает нижнюю границу камеры), `maxLiveLayers` остаётся верхним пределом | Phaser 4 не отсекает объекты вне камеры; раздел 9 документа 06 требует пул для слоёв под экраном |
| 2026-11-13 | Камера держит летящий слой целиком (с покачиванием) ниже нижней границы HUD плюс `ANIM.camera.hudClearance`; граница HUD лежит в `data/hud-layout.ts` (`HUD_LAYOUT.bottomEdge`) и общая для `hud-scene` и `game-scene` | На низких экранах летящий слой заходил под шкалу качки |
| 2026-11-13 | Тень-подсказка рисуется тёмной полосой на верхнем слое башни, по ширине летящего слоя, обрезанной по верхнему слою | Раздел 4 документа 06: «на верхнем слое башни видна тень летящего слоя» |
| 2026-11-13 | Пауза в M2: «Продолжить» (с отсчётом 3-2-1) и «Заново». Переключатели звука и вибрации добавлены в M3 (см. ниже), кнопка «Домой» появится вместе с Home (M6) | Home ещё нет |
| 2026-11-13 | Числа HUD форматируются `formatNumber` из `i18n` (разделитель берётся из `Intl`, группировка всегда включена, в том числе для четырёх цифр в ru). Язык по умолчанию определяется по первой (системной) локали | Раздел 7: `1 250` для ru и `1,250` для en; раздел 11: язык следует системному |
| 2026-11-13 | Бот не тапает позже первого отскока от стены после прохода цели | Большая поздняя ошибка иначе оставляла слой летать вечно |
| 2026-11-13 | Частицы: пул `Image` и собственная функция шага (`fx/particle-motion.ts`), а не Phaser `ParticleEmitter`. Все пакеты идут через `Particles.emit` и приватный `scaledCount`: точка, где этап 7 («меньше эффектов») сможет масштабировать числа. Математика частиц чистая, без Phaser, случайность подменяется в тестах | Общий лимит 250 частиц на все эффекты проще держать в одном пуле, а чистый код тестируется без Phaser |
| 2026-11-13 | Пыль: у `ANIM.dust.style` нет жизни, она берётся из `ANIM.dust.lifeMs`; остальные пресеты задают `lifeMs` диапазоном. Формы текстур (звезда, крошка, искра) рисуются веером треугольников от центра | В Phaser 4 нет `fillStar` |
| 2026-11-13 | Кольцо идеального броска — эллипс (ширина = ширина слоя × `widthRatio`, высота = ширина × `heightRatio`), одна текстура `fx_ring`, масштабируется `Image`. Текст «Идеально!» и «×N» (с комбо ≥ 2) живёт 900 мс: появление 160 мс, подъём 80 px, затухание последние 500 мс; стоит над слоем на `ANIM.perfect.text.liftY` | Раздел 4 документа 06 не задаёт форму кольца и точку появления текста |
| 2026-11-13 | Эффекты приземления собраны в `fx/landing-fx.ts` (частицы, кольцо, текст), `run-fx.ts` только вызывает их по событиям симуляции | `run-fx.ts` иначе перешёл бы за 300 строк |
| 2026-11-13 | Звук целиком синтезируется Web Audio в `services/audio` (`Synth` → компрессор → выход), аудиофайлов нет, числа рецептов лежат в `data/sfx.ts`. `AudioContext` создаётся лениво в `unlock()` из жеста игрока; звуки до `unlock`, при выключенном звуке и в фоне молча отбрасываются. Веб-реализация работает на всех платформах до M7 | Нативная оболочка Capacitor тоже работает на Web Audio, отдельный нативный звук не нужен |
| 2026-11-13 | Нотная лестница комбо: мажорная пентатоника от C5 (0, 2, 4, 7, 9 и октава выше), 12 ступеней, шаги выше 12 остаются на 12-й; громкость колокольчика растёт на 7% за ступень до ×1,5. Рассыпание башни: громкость шлепка падает в 0,9 раза за индекс (пол 0,12), не чаще раза в 45 мс по времени контекста | Раздел 7 документа 06 задаёт лестницу словами; 100 слоёв не должны создавать сотни голосов |
| 2026-11-13 | Музыка отложена по решению владельца: в M3 только звуковые эффекты. Сворачивание игры ставит звук на паузу через `AudioService.suspend/resume` (`game/audio-lifecycle.ts`: события Phaser `HIDDEN`/`VISIBLE`, регистрируются один раз в `BootScene`; жесты для `unlock` ловятся нативными слушателями окна) | Решение владельца; `unlock` обязан выполниться внутри жеста, а не из очереди кадров Phaser |
| 2026-11-13 | Вибрация: интерфейс `HapticsService` и веб-заглушка `WebHaptics` на `navigator.vibrate` (паттерны и порог большого откусывания `bigBiteShare` в `data/haptics.ts`, правило в `services/haptics/bite.ts`); Capacitor Haptics придёт на M7 второй реализацией. Реализации выбирает единственное место `services/index.ts` | Правило 4 из `CLAUDE.md`; сцена и нативная реализация используют одно условие |
| 2026-11-13 | Какой звук и какая вибрация играют на шаге симуляции, решает чистый модуль `fx/run-cues.ts` (события шага → список звуков и вибраций), `playCues` лишь вызывает сервисы. Обвал вызывает `collapseThud(индекс в серии)` через колбэк `onDrop` у `TowerCollapse`. Кнопки (`ui/button.ts`) издают клик и вибрацию `selection` ровно один раз на нажатие, уже после действия кнопки: переключатель, который только что включили, подтверждает себя, а выключенный молчит | Игровых правил в этом модуле нет, только сопоставление «событие → ощущение» |
| 2026-11-13 | (заменено в M6, см. ниже) Рекорд пока только внутри сессии браузера: `game/session-record.ts` держит лучшую высоту в памяти, первый забег сессии рекордом не считается. Сохранение приходит в M6 | Решение владельца: сохранения до M6 нет |
| 2026-11-13 | (заменено в части хранения в M6, см. ниже) Выключатели «Звуки» и «Вибрация» стоят в окне паузы и хранятся только в памяти (флаги `enabled` у сервисов), настройки сохранятся в M6. Праздник рекорда (конфетти, лента, фанфары, серия `triple`) живёт в сцене результатов со своим экземпляром `Particles` (свой лимит 250) и очищается по `SHUTDOWN`; в dev-сборке клавиша `R` в сцене результатов запускает его для проверки | Решение владельца |
| 2026-11-13 | Тип `Rarity` и список `RARITIES` лежат в `data/rarity.ts` | Их будут использовать и звуки способностей, и данные существ (M4) |
| 2026-11-13 | Звуковой менеджер Phaser выключен (`audio: { noAudio: true }` в `game/config.ts`), все звуки идут через `AudioService` | Иначе Phaser при старте создаёт второй `AudioContext` вне жеста пользователя и держит его всю сессию; единственный контекст создаёт `services/audio` внутри жеста |
| 2026-11-13 | (заменено в части хранения в M6, см. ниже) «Меньше эффектов» держит `game/effects-mode.ts` (один экземпляр на игру, в памяти до M6). Приоритет: переключатель игрока → системное «Уменьшение движения» (`prefers-reduced-motion`, следим и за изменением) → автоматическое включение. Автомат (`fx/low-fps-watch.ts`) считает среднюю частоту кадров забега за последние 2 с; кадр длиннее `ANIM.fx.lowFpsHitchMs` (250 мс: переключение вкладки, загрузка) начинает окно заново. Включившись, режим остаётся до конца сессии; если игрок выключил его сам, автомат больше не вмешивается. Режим вдвое уменьшает каждый пакет частиц (не меньше 1, конфетти рекорда тоже) и убирает волну сплющивания. Переключатель стоит третьим в окне паузы, рядом со звуками и вибрацией; в панели отладки строка `fx` показывает причину | Окна настроек до M6 нет; без гистерезиса режим мигал бы при колебаниях около 50 кадров |
| 2026-11-13 | Переходы собраны в `ui/transition.ts`: `enterScreen` (элементы выпадают сверху на 180 px с `backOut` 280 мс каскадом через 40 мс), `leaveScreen` (элементы уезжают вниз за 200 мс, камера верхней сцены затемняется цветом `textDark` и тем самым затемняет все сцены под ней), `enterWorld` (мир забега опускается сверху через добавку к прокрутке камеры и проясняется из того же цвета), `openPopup` (затемнение 150 мс, окно 0,7 → 1 за 240 мс). Забег (в том числе первый после загрузки) входит через `enterWorld` и каскад HUD; результаты входят каскадом и уходят через `leaveScreen` по «Ещё раз»; «Заново» в паузе тоже уводит окно через `leaveScreen` | Раздел 6 документа 06 не задаёт расстояние сдвига; затемнение камерой не требует отдельного полноэкранного объекта в каждой сцене |
| 2026-11-13 | «Дыхание» и блик раз в 3 с (`Button.breathe()`) получила кнопка «Ещё раз» на экране результатов: кнопки «Играть» до M6 нет. Нажатие, дыхание и переходы не гасят друг друга: нажатие меняет масштаб самой кнопки своим твином, дыхание — масштаб внутреннего контейнера, переходы — положение и прозрачность. Пробег блика общий для слоя и кнопки: `fx/gloss-sweep.ts` | Раздел 6 документа 06 |
| 2026-11-13 | Числа HUD (высота, очки) и высота на экране результатов прокручиваются через `ui/number-roll.ts`: длительность 400 мс для изменения на 1 и растёт по логарифму до 800 мс при изменении от `ANIM.ui.numberRollBigChange` (1000), кривая cubic-out; новое значение посреди прокрутки продолжает от показанного. Первое значение забега показывается сразу (`?start=96` не прокручивается с нуля), высота на экране результатов прокручивается с 0. Панель отладки и отсчёт 3-2-1 не прокручиваются | Раздел 6 документа 06: «прокручивается за 400–800 мс» |
| 2026-11-13 | `launchRun` перезапускает вызывающую сцену через `scene.restart()`, остальные через `scene.launch()` | Phaser игнорирует `launch` своей же сцены: «Заново» из паузы перезапускал забег, но HUD оставался со старым окном паузы |
| 2026-11-13 | Кнопки окна паузы и результатов шире: 560 → 680 | Надпись «Меньше эффектов: Выкл» не помещалась |
| 2026-11-14 | Ядро монет (парящая монета, монеты за комбо, золотой слой, бонус высоты в конце забега) перенесено из M5 в M4 | Решение владельца: без монет нельзя проверить баланс бригад в `npm run sim`. На экране монеты и счётчик в HUD остаются в M5 |
| 2026-11-14 | `CreatureId` теперь объединение 12 строк из `data/creatures.ts` (`CREATURE_IDS`), а не `string`; id эффекта равен id существа | Реестр `Record<CreatureId, Ability>` проверяет компилятор: тринадцатое существо не пройдёт без способности |
| 2026-11-14 | Усиленные целые значения (N слоёв) округляются через `Math.round` (3 × 1,5 → 5, 5 × 1,5 → 8, 7 × 1,5 → 11) | В документе 03 округление не указано; флага для переключения нет |
| 2026-11-14 | Продление эффекта: `layersLeft` берётся максимальный, `value` берётся более сильный (у Морозко и Крохи сильнее меньшее значение, флаг `Ability.lowerValueIsStronger`), `boosted` = старый или новый | Правило «заменяется, если больше» из документа 03 не годится для значений, где меньше значит сильнее |
| 2026-11-14 | Высота башни больше не равна `layers.length`: `height = layers.length + bonusHeight`, следующий слой получает индекс `height + 1` | Двойняшки считаются за 2 слоя высоты, но кладут один слой |
| 2026-11-14 | Полный промах не спасает ни «Радужка», ни допуск: проверка промаха (`distance >= width - missMargin`) идёт раньше `autoPerfect`; порядок в `drop.ts`: допуск `perfectTolerance`, промах, `autoPerfect`, обычный | В документе 03 «кроме полного промаха». Допуск `distance <= perfectTolerance` по-прежнему главнее, в том числе на узком слое |
| 2026-11-14 | Щит Брауни спасает и от «чиха» (ширина после откусывания меньше `missMargin`): щит сгорает, `miss {shielded: true}`, забег идёт дальше, узкий слой остаётся в башне, ширина следующего слоя `max(текущая, team.shieldRestoreWidth)` = `max(текущая, 250)` (и для промаха броском, и для «чиха»; продолжение после рекламы остаётся `continues.restoreWidth` = 360) | Решение владельца (прежние значения: промах броском держал ширину, «чих» давал 360). При промахе мимо слоя слой возвращается с тем же индексом и видом, новая монета не бросается |
| 2026-11-14 | Щит, потраченный на промах, не шлёт `effect_end`: сигналом служит `miss {shielded: true}`; `effect_end 'shield'` приходит только когда щит истёк по слоям | Иначе одно и то же событие дублировалось бы |
| 2026-11-14 | Эффекты тикают после начисления очков приземлившегося слоя; способность существа запускается после тика, поэтому новый эффект начинается с полным N. Промахи (в том числе со щитом) эффекты не тикают | Правило «N слоёв считает слои после существа» |
| 2026-11-14 | Парящая монета проверяется по слою после откусывания, до расширения за комбо и до «Пышки»: центр монеты внутри `x ± width / 2`. Монета не ограничена краями экрана. Бросается один раз при появлении нового индекса слоя из потока `rng.fork('coins')`; после промаха монета пропадает, повторное появление слоя (щит, продолжение) новую не бросает | Раздел 7 документа 02 не уточняет момент проверки и судьбу монеты |
| 2026-11-14 | Золотой слой и бонус высоты платятся фиксированно: золотая монетка/очки не умножаются на «Карамельку» и «Искорку». Золотой слой каждые 25 слоёв; если этот индекс занимает существо, золотым становится следующий слой без существа; если индекс перепрыгнули двойняшки, золотой слой переносится на следующий индекс. Монеты за комбо с 5-го идеального умножаются на `1 + coinMultAdd`, монеты Кислинки и Крохи не умножаются | Раздел 7 документа 02 и раздел 2 документа 05 не описывают столкновения золотого слоя с существом и двойняшками |
| 2026-11-14 | Бот под «Безешкой» (`ghost`, `guides`): стандартное отклонение тайминга умножается на `DIFFICULTY.guidesSdMult` = 0,7. Это допущение модели бота, а не правило игры | Решение владельца: реальный эффект направляющих на человека бот измерить не может. Ровно одна выборка `rng.normal()` на слой сохраняется, базовые результаты без бригады не меняются |
| 2026-11-14 | `npm run sim` печатает таблицу на каждый профиль и набор бригад (все на 3-м уровне, `data/sim-teams.ts`) и проверки полных бригад: попадание в +30…+50% к медиане и «лидер и по высоте, и по монетам». Параметры `--runs`, `--profile`, `--team`, `--level`. Базовый набор `none` играется всегда | Критерии готовности M4. Зёрна и шум бота общие для всех наборов, дельта считается парно |
| 2026-11-14 | Окно щита «Брауни»: тик щита и запуск способности идут до проверки «чиха», поэтому слой Брауни и слой N+1 не защищены, а слои 1..N защищены и от промаха броском, и от «чиха». В `resolveLanding` признак `shieldedLanding = s.shield > 0` берётся до `tickRunEffects` и передаётся в `miss(events, 'sneeze', shieldedLanding)`; на слое N щит истекает (`effect_end 'shield'`), но слой ещё прикрыт. Собственный «чих» слоя «Брауни» новым щитом не прикрыт | Решение владельца: окно ровно N слоёв после существа для обоих видов промаха |
| 2026-11-14 | Баланс существ после M1 пересчитан симуляцией (набор B, утверждён владельцем): «Медок» R 34/38/42/46/52 (было 28/32/36/40/46); «Пышка» X 50/60/70/80/100 (было 60/75/90/105/130); «Безешка» N 3/3/4/5/6 (было 4/5/6/7/9); «Радужка» N 1/1/2/2/3 (было 2/2/3/3/4, усиление по-прежнему +1); «Карамелька» N 8/10/12/14/18 (было 5/6/7/8/10); «Кроха» K 24/20/16/13/10 (было 40/34/28/24/18); новая `BALANCE.team.shieldRestoreWidth` = 250 | После M1 допуск идеального 20 и расширение за комбо усилили игрока: значения из документа 03 давали полным бригадам до +95% к медиане на обычном профиле, а одна бригада лидировала и по высоте, и по монетам; щит Брауни возвращал слишком узкий слой (+3%) |
| 2026-11-14 | Уровень существа ограничивается 1..5 один раз в `planLayer` и ещё раз в `runAbility`; в `PlacedLayer.level` и `ActiveEffect.level` попадает ограниченное значение | Экран не должен показывать уровень, которого способность не использует |
| 2026-11-14 | Альтернативные цены в `UnlockDef` — отдельные записи (`lemon`: 2500 монет и 250 ягод это два варианта, а не одна цена из двух валют); `shop` держит ровно одну валюту | Однозначность для магазина (M6) |
| 2026-11-14 | Качка усилена (утверждено владельцем, вариант 2 из трёх): `gainFactor` 60 → 120, `perfectRelief` 15 → 10, `decayPerSec` 2 → 1, `amplitudeMax` 90 → 130. Варианты владелец сравнивал руками через временный параметр `?wobble=N` в сборке разработки; после выбора параметр и пресеты удалены | `npm run sim` показал, что при допуске «идеально» 20 качка почти не работала: у обычного профиля медиана качки в момент касания 2, средняя амплитуда 4 px, чих раз в 30 забегов, а без качки вовсе медиана высоты та же. Бот видит раскачивающуюся цель точно и ошибается только на время падения, поэтому живому игроку качка мешает сильнее, чем показывает симуляция |
| 2026-11-14 | Перебалансировка существ после усиления качки (набор F): «Медок» R 30/34/38/42/48 (было 34/38/42/46/52), «Пышка» X 45/55/65/75/90 (было 50/60/70/80/100), «Брауни» N 5/7/9/11/13 (было 6/8/10/12/15); второй эффект «Желейки» с P = 30/35/40/45/55 (первый прогон с 35/40/45/50/60 дал две бригады без «Радужки» и «Безешки» на +51–53%, P снижено на 5 пунктов). Итог `npm run sim --all-teams`: «Желейка» в одиночку +11% у обычного профиля, ни одна из 220 бригад не лидирует и по высоте, и по монетам, бригады без «Радужки» и «Безешки» не выше +50% | С новой качкой пять нелегендарных бригад вышли за +50% на обычном и экспертном профилях, а «Желейка» давала 0–1%: бот теряет высоту в основном на чихах, и одно гашение качки не ценится |
| 2026-11-14 | Правило пружины «Желейки»: `DropOutcome.dx` у обычного броска равен смещению после пружины (`dx × (1 − springShare)`), от него считаются откусывание, центр, прирост качки и монеты «Крохи»; идеальный бросок и промах решаются по исходному dx. Новый модификатор `Modifiers.springShare` (0..1, база 0, слияние эффектов через максимум), эффект «Желейки» длится 4 слоя (×1,5 при идеальном, 4 → 6) со значением P/100 | Желейка получает вторую, ощутимую для высоты способность без изменения гашения качки; максимум при слиянии не даёт пружинам складываться |
| 2026-11-14 | «Безешка» оставлена 3/3/4/5/6 по решению владельца: её сила в симуляции держится на допущении модели (бот в 0,7 раза точнее с направляющими). Небольшой выход бригад с «Безешкой» за +50% допустим; вопрос на проверку живыми игроками (TestFlight, M9) | Допущение `DIFFICULTY.guidesSdMult` нельзя проверить без людей |
| 2026-11-14 | `npm run sim --all-teams`: полные бригады для проверок — все 220 сочетаний по три существа, печатаются сводки и итоговые критерии приёмки вместо 220 строк | Именные бригады не показывают доминирование и выходы за +50% по всем сочетаниям |
| 2026-11-14 | Временный выбор бригады в сборке разработки: `util/debug-params.ts` читает `?team=` и `?level=`, `game/debug/debug-team.ts` держит бригаду сессии в памяти (URL задаёт начальное значение), панель отладки листает слоты и уровень, `restart` вызывает `launchRun`. Панель регистрирует свою область в `ui-regions`, касание по ней не роняет слой. Базовый уровень `BALANCE.team.debugLevel` = 3. Исчезнет с экраном «Команда» (M6) | Нужно смотреть способности и значки без экранов M6 |
| 2026-11-14 | `nextCreature(height, team)` в `core/team-queue.ts` считает от `height` (слои плюс бонус двойняшек), а не от числа слоёв: летящий слой имеет индекс `height + 1`, `inLayers = 0`, когда он сам слой-существо; пустые слоты пропускаются, без бригады `null` | Тот же счёт, что у `planLayer`, поэтому подсказка не расходится с тем, что выпадет |
| 2026-11-14 | Правила значков HUD: значок эффекта (и щита, с иконкой Брауни) появляется с `backOut`, пульсирует, при 1 слое мигает, по окончании сжимается за `badges.outMs` и убирается; вернувшийся эффект возвращает ещё не убранный значок. Состояние — чистый `BadgeTracker` (`ui/effect-badge-state.ts`), отрисовка — пул слотов `ui/effect-badges.ts` без выделений в кадре. «Следующее существо» (`ui/next-creature-badge.ts`) пересчитывается только при смене высоты или бригады, «выскакивает» при смене текста или существа и скрыт без бригады. Ряд значков и подсказка лежат на `HUD_LAYOUT.badgeRowY`, `bottomEdge` стал нижним краем ряда | Раздел 4 документа 06 и раздел 4 документа 07 |
| 2026-11-14 | Множественное число: `tn(key, n)` в `i18n` берёт форму по `Intl.PluralRules`; запись в словаре — формы `категория=текст` через `\|` (`one=через {n} слой\|few=через {n} слоя\|other=через {n} слоёв`). Нет формы — `other`, затем последняя | Одинаковые ключи в en и ru, а число форм у языков разное |
| 2026-11-14 | Значки существ — `assets/svg/icon_<id>.svg` (64×64), ключ текстуры `icon_<id>`. Загрузчик SVG обобщён: `loadSvgTextures(scene, keys, scale)` в `objects/svg-textures.ts` читает все `assets/svg/*.svg` (текст плюс blob-URL), лица и значки идут через него; значки растрируются в `HUD_LAYOUT.iconTextureScale` = 2 раза крупнее и показываются уменьшенными | Не дублировать загрузчик лиц; на экране значок крупнее 64 px |
| 2026-11-14 | Промах под щитом (`miss {shielded: true}`) в сцене не запускает ожидание промаха, коллапс и результаты: пропавший слой падает кусочком с лицом ужаса (`RunFx.onMiss`), забег идёт дальше, звук `drop` и вибрация `medium` вместо звука промаха и `error`. Чих под щитом ничего не роняет. Падающий слой кладётся на `layers.length`, а не на `height` (двойняшки), цвет летящего слоя берётся по `layers.length + 1`, чтобы он не менялся при посадке | Двойняшки сдвигают `height`, но не число слоёв, а `TowerView` рисует по `layers` |
| 2026-11-14 | `LayerView.setLook(plan)` и `look` хранят вид слоя (`kind`, `creature`, `level`); `TowerView`, `FlyingLayerView`, падающие куски и коллапс его передают, рисунок пока одинаков для всех видов | Подготовка к рисунку существ |
| 2026-11-14 | Слои-существа запекаются как простые: ключ текстуры `layer_c_<id>_<ширина>_<n\|l\|r>` (у простых `layer_<цвет>_<ширина>_<срез>` без изменений), тот же счётчик пользователей и лимит простаивающих текстур; `LayerView.setLook` теперь вызывается до `setLayer`, а кэш вида учитывает существо | Один механизм освобождения; существо не зависит от таблицы цветов простых слоёв |
| 2026-11-14 | Рисунок существ: общие примитивы слоя вынесены из `layer-art.ts` в `objects/layer-draw.ts` (корж, глазурь с потёками и волнистым краем, бисквит среза, блик), на них стоят 12 рисовальщиков в `objects/creature-art/` (`baked`, `creamy`, `layered`, диспетчер в `index.ts`); числа рисунка (число полос, бугорков, посыпки, высота детали) лежат в `data/creature-looks.ts`, цвета в `palette` существа (добавлены `detail` и `sponge`) | Один рисовальщик на существо вместо общего рецепта: рисунки слишком разные; данные отдельно от кода |
| 2026-11-14 | Деталь над верхним краем: рецепт задаёт `topPad`, текстура растёт только вверх на это число, у `Image` задаётся `originY = artOriginY(существо)`, поэтому тело слоя (высота `BALANCE.layer.height`, центр) стоит на месте и физика с размещением не меняются. Рисунок обрезается по ширине без маски: полосы берутся с учётом скруглённых углов, штучные элементы считаются от ширины (`countFor`), чтобы плотность не менялась при откусывании | `generateTexture` не умеет маски; рисунок откусанного слоя не должен «прыгать» |
| 2026-11-14 | «Желейка» и «Безешка» полупрозрачны через `alpha` рецепта: он применяется к картинке слоя (`artAlpha`), а не к фрагментам рисунка | Наложение полупрозрачных полос внутри одной текстуры давало неравномерную плотность |
| 2026-11-14 | Лицо существа задаётся `FaceRecipe` в `data/creature-looks.ts` (позы бровей, рот по умолчанию, веки, румянец, сдвиг, пара лиц). `resolveExpression` получил рецепт: у существа брови видны всегда (`ownBrows`: своя поза, «ой» и «ужас» и испуг дают общую позу «домиком»), рот по умолчанию заменяет только `smile` покоя, веки (`lids`) только у спокойного лица с открытыми глазами. Картинки лица вынесены из `LayerFace` в `FaceParts`; у «Двойняшек» второе лицо создаётся лениво, лица смотрят друг на друга (`pair.gaze`). Новые SVG: `face_lid` (веко, окрашивается цветом тела) и `face_brow_light` (светлые брови для тёмного «Брауни») | Реакции работают поверх лица существа без отдельной ветки |
| 2026-11-14 | Значки HUD увеличены: сторона 76 → 108 логических пикселей (около 39 css px на экране 390 px), шрифт счётчика 34 → 52, «следующее существо» 40 → 56; ряд значков по центру на 456, `bottomEdge` считается из этих чисел | Замечание владельца: мелко на телефоне |
| 2026-11-14 | Анимации способностей: общий шаблон (вспышка слоя и кольцо цвета редкости, «Усилено!» и второе кольцо) в `fx/abilities/ability-fx.ts`, фирменная анимация каждого существа — отдельный файл в `fx/abilities/`, реестр `SIGNATURES: Record<CreatureId, SignatureFx>` в `signatures.ts` (13-е существо = один файл и одна строка; пропуск ловит компилятор и тест). Общие кисти: `SpriteFx` (пул картинок с чистым описанием движения `sprite-motion.ts`), `AbilityBursts` (частицы через общий пул на 250), `LayerRig` (вспышка, прыжок, прозрачность и разрез слоя на половинки) | `run-fx.ts` уже у предела в 300 строк; все числа лежат в `data/ability-anim.ts` |
| 2026-11-14 | Цвета редкости лежат в `data/rarity.ts` (`RARITY_COLORS`: зелёный, синий, фиолетовый, золотой) и используются вспышкой и кольцом способности | Одно место для цвета редкости, рамки карточек в M6 возьмут его же |
| 2026-11-14 | Эффекты «пока действует» (`fx/abilities/while-active.ts`) каждый кадр читают `state.effects`, `state.shield` и модификаторы (`TowerSim.currentModifiers()`, сцена обновляет их при каждом шаге с событиями) и сами ничего не решают: направляющие и подсветка Безешки (условие `guideGlow`, допуск берётся из модификаторов), пузырь Брауни (автомат `nextBubblePhase`: лопается по `miss {shielded}`, тает по `effect_end 'shield'`), лёд и радужный отлив на летящем слое, жёлтая виньетка, полёт крошек к Крохе. При конце забега флаги сбрасываются, всё гаснет плавно | Чистое чтение состояния держит правила игры в ядре; чистые помощники покрыты тестами |
| 2026-11-14 | Режим «меньше эффектов»: частицы и облака вдвое меньше (общий `effectsMode.particleCount`), без радужной волны на весь экран, без пульсации виньетки и без волны покачивания Желейки по башне; кольца, подписи, значки и направляющие остаются | Информация сохраняется, отбрасывается только украшение |
| 2026-11-14 | Реакции лица для способностей (`wink`, `scrunch`, `gape`, `blow`, `puffed`, `strain`) стоят в приоритете выше «ой» и ниже `squint` и `horror`; подмигивание закрывает правый глаз, раздутые щёки — поле `puffed` выражения. Прыжок, прозрачность и разрез слоя живут в числах `LayerRig`, которые применяются к контейнерам раз в кадр, поэтому сквош не оставляет слой в чужой позе. Плавное успокоение качки Желейки — `TowerView.freeze(0, calmLerp)` до синхронизации с новым состоянием | Лица и качка остаются состоянием, а не набором твинов |
| 2026-11-14 | Промах под щитом играет звук «лопнувший пузырь» (`AudioService.shieldPop`, рецепт `SFX.shieldPop`) и вибрацию `medium` вместо звука падения; способность — `audio.ability(редкость)` и вибрация `success` (раздел 8 документа 06; раздел 4 приведён к нему по решению владельца) | Отдельный звук читается лучше обычного шлепка |
| 2026-11-14 | «Двойняшки»: крем ровно посередине (`topShare` 0,44), лица на верхней гладкой ракушке, «ножки» макарона — тонкая шершавая кромка из мелких бугорков у крема (`feetRadius`), а не ряд крупных кружков. Фирменная анимация: верхняя ракушка приподнимается (`LayerRig.splitApart`, разрез по середине крема, `twinsSeam`), в зазоре вспыхивает крем, ракушка опускается; оба лица хмурятся (`strain`) | Ракушки лежат одна на другой, а не слева и справа; так фигура отличается от «Искорки» и в оттенках серого |
| 2026-11-14 | Вибрация способности — `success` (раздел 8 документа 06 главнее раздела 4, он исправлен); щит ловит промах — `medium` | Два места документа противоречили друг другу, решение владельца |
| 2026-11-14 | Пузырь Брауни рисуется в два слоя: шоколад и нижняя дуга лежат за башней (`DEPTH.bubbleBack`), верхняя дуга и блик перед ней (`DEPTH.bubble`); пузырь, у которого закончился щит на шаге с промахом под щитом, лопается, а не тает; конец забега растапливает пузырь, а не обрывает (`bubbleInputFor`) | Сплошной овал поверх башни пачкал верхний слой и походил на поля шляпы |
| 2026-11-14 | Разбиение модулей по 300 строк: `fx/debris-fx.ts` (откусывание, чих, упавший слой; общие цвета крошек и капель `cakeColorsFor` берут цвета существа), `objects/sway-hold.ts` (чистая «заморозка» качки, с тестом), `objects/tray.ts`, `ui/next-creature-label.ts` (чистая подпись, с тестом); числа, цвета и кривые анимаций способностей собраны в `data/ability-anim.ts` | `run-fx.ts` и `tower-view.ts` превышали 300 строк, повторяющиеся значения лежали в коде |
| 2026-11-14 | Материалы существ (`data/creature-materials.ts`, раздел 3 документа 06, «Материал»). Форма: в `LayerView` между `squashRoot` и `content` стоит `shapeRoot`, прижатый к нижнему краю; `LayerMaterial` каждый кадр задаёт ему масштаб из чистой `materialShape` (колыхание при качке, покой, дрожь после удара, с тестами). Наклон при качке умножается на `material.tilt` вокруг центра слоя. Приземление и волна идут через `LayerView.playImpact(сила)` с глубиной, длительностью и плавностью материала (`landSquash`, `waveStep` в `anim-curves.ts`); фирменные анимации по-прежнему зовут `playLanding` с точными числами. Частицы, блик, толчок камеры и волна Брауни — `fx/material-fx.ts`. Отставание ракушки Двойняшек — `LayerRig.lagShell`, не перебивает идущий разрез способности | Центр слоя по горизонтали не трогается ничем, кроме симуляции: игрок целится по верхнему слою |
| 2026-11-14 | Пузырь Брауни перерисован в мыльный пузырь: заливка `#fff4e4` с прозрачностью 0,12, свечение к краю цвета `detail` Брауни, светлый обод 4 пикселя с розово-голубой плёнкой, блик-полумесяц и искра; пузырь шире (`padX` 80) и выше (2,5 слоя) | Прежний тёмный обод читался как коричневое кольцо вокруг верхнего слоя (замечание владельца) |
| 2026-11-14 | «Двойняшки»: верхняя ракушка занимает 60% высоты (`topShare` 0,6), крем ниже середины, лица 0,72 обычного (было 0,52) на расстоянии 112 от центра; ниже ширины 360 пара уменьшается, ниже 170 остаются глаза и брови | Лица мелко читались на телефоне (замечание владельца) |
| 2026-11-14 | Зона слоя `i`: `min(5, floor((i − 1) / BALANCE.zones.length))`. Таблица зон и все числа правил лежат в `data/zones.ts` (`ZONES`, `ZONE_RULES`, `SPACE_RULE_POOL`), id зон `kitchen`, `showcase`, `roof`, `clouds`, `stars`, `space` | Раздел 8 документа 02 даёт таблицу без формулы; правило «никаких магических чисел» требует данных |
| 2026-11-14 | Потолок 1400 действует в двух местах. База `layerSpeed(высота, 1)` ограничена 1400 в любой зоне (раздел 3 документа 02), то есть с высоты 89. Дополнительно в Космосе потолок действует на «базу × множитель зоны»: `nominal = min(потолок зоны, layerSpeed(высота, 1) × speedMult зоны) × speedMult способностей`. Рывок ×1,35 и «Морозко»/«Лимонка» умножают поверх, так что скорость может превысить 1400. Следствия: множитель Космоса 1,15 ничего не меняет (Космос начинается с высоты 100, где база уже 1400), все слои Космоса летят ровно 1400, а поздние «Звёзды» (высота 89–99) летят 1400 × 1,1 = 1540, то есть при входе в Космос скорость падает примерно на 9%. Множители зоны не лежат в `Modifiers` | В документе 02 не сказано, к чему относится «ограничена 1400». Решение владельца, смысл потолка и его следствия показаны владельцу вместе с таблицей sim на подтверждение. Из-за этого раздел 4 («зоны входят в `Modifiers`») уточнён |
| 2026-11-14 | Повтор слоя «Звёзд» (щит, продолжение) считается новой жизнью слоя: обманка бросается по индексу, поэтому срабатывает снова в той же точке. «Один раз за жизнь» значит один раз за появление слоя, а не за индекс | В документе 02 не сказано, начинает ли повтор новую жизнь. Так проще всего и расписание остаётся чистой функцией зерна и индекса |
| 2026-11-14 | Множитель очков зоны (по зоне летящего слоя) умножает очки обычного и идеального броска вместе с `scoreMult` способностей; золотой бонус +100 остаётся плоским | Раздел 8 документа 02 не уточняет, к чему применяется множитель. Решение владельца |
| 2026-11-14 | Все правила выбираются по индексу слоя, а не по ходу игры: `zonesRng = rng.fork('zones')`, на слой `zonesRng.fork('layer:<индекс>')` с вложенными потоками `rule`, `side`, `fakeout`, `cloud:<проход>`; рывки Витрины считаются из `zonesRng.fork('rush')`. Парящая монета тоже бросается из `coinRng.fork('layer:<индекс>')`. Повтор слоя (щит, продолжение) и пропуск индексов двойняшками не сдвигают расписание | Башня дня должна быть одинаковой у всех, а расписание не должно зависеть от числа бросков до слоя. Раньше монета брала числа из общего потока по порядку появления слоёв |
| 2026-11-14 | Витрина: сторона появления случайна у каждого слоя зоны (вне Витрины и вне правила «рывок» Космоса сторона по чётности индекса). Рывки: первый на слое `20 + int(4, 6)`, каждый следующий через `int(4, 6)` слоёв, только внутри слоёв 21–40 | Раздел 8 документа 02: «раз в 4–6 слоёв» без начала отсчёта. Решение владельца |
| 2026-11-14 | Рывок: слой появляется и стоит неподвижно `ZONE_RULES.rush.windupMs` = 300 мс (сцена рисует пульсирующий красный контур и замах), затем летит со скоростью номинал × 1,35 до конца жизни. Касание во время замаха бросает слой там, где он стоит, по обычным правилам | Документ 02 говорит про «контур заранее» и ×1,35 «на один слой». Решение владельца: контур с момента появления и замах |
| 2026-11-14 | «Крыша»: мгновенная скорость = номинал × (`edge` + (`centre` − `edge`) × sin(π·u)), `u` = положение центра слоя на дорожке 0..1 (от `minCenterX` до `maxCenterX`), `edge` 0,8, `centre` 1,2 | Документ 02: «замедляется у краёв, ускоряется в центре (синусоидальный профиль)» без чисел. Числа утверждаются владельцем через `npm run sim` |
| 2026-11-14 | «Облака»: проход слоя начинается при появлении и при каждом отскоке от стены; в проходе с шансом 0,5 приходит одно облако, закрывающее слой на 300–500 мс (бросается), с момента, когда слой пройдёт долю дорожки 0,15–0,6 от места начала прохода. Облако не меняет физику; приход облака, пока держится прошлое, продлевает укрытие до большего. В состоянии: `FlyingLayer.coverMs`, `pass`, событие `cloud {coverMs, pass}` | Документ 02: «не более одного облака за проход», без шанса и момента. Решение владельца |
| 2026-11-14 | «Звёзды»: с шансом 0,3 слой один раз за жизнь останавливается на 150 мс в точке, где доля дорожки бросается из 0,2–0,8, срабатывает при первом пересечении точки; слой стоит (событие `fakeout {x, stopMs}`, `stopMs`), потом меняет направление. Отскок от стены в этом правиле не отличается от обычного | Документ 02: «в случайной точке» без допустимого диапазона. Решение владельца |
| 2026-11-14 | Космос: каждый слой получает одно правило из «рывок Витрины (со случайной стороной)», «Крыша», «Облака», «Звёзды», и выбранное правило срабатывает всегда: рывок гарантирован, обманка с вероятностью 1, облако на первом проходе гарантировано, на следующих 50% | Документ 02: «одно случайное правило из зон 2–5». Решение владельца: правило не должно «не сработать» в зоне, где игрок ждёт сложности |
| 2026-11-14 | Движение слоя вынесено из `tower-sim.ts` в `core/flight.ts` (класс `Flight`, чистые `flyingSpeed`, `roofFactor`, `newFlyingLayer`); `TowerSim` остаётся машиной состояний. `FlyingLayer` расширен полями правил (`zoneIndex`, `rule`, `rush`, `windupMs`, `stopMs`, `coverMs`, `pass`), в `SimEvent` добавлены `cloud` и `fakeout`, в `coin_collect` поле `source` (`floating`, `combo`, `perfect`, `crumb`, `golden`, `height`) | Файл `tower-sim.ts` уже на пределе размера; сцене и экрану результатов нужны источник монет и состояние правил |
| 2026-11-14 | Бот на правилах зон: оценка времени до цели идёт по `flyingSpeed` (профиль «Крыши», рывок); пока слой стоит (замах, остановка обманки), оценки нет и бот не касается; на остановке обманки направление и «цель пройдена» сбрасываются, чтобы разворот не считался отскоком от стены. Пока слой закрыт облаком, ошибка тайминга бота умножается на `DIFFICULTY.cloudSdMult` = 1,5 | Допущение модели бота, а не правило игры (как `guidesSdMult`): игрок не видит закрытый слой. Решение владельца |
| 2026-11-14 | `npm run sim` без `--all-teams` не выносит вердикт по доминированию: «dominance: not checked, the check needs --all-teams» на профиль и «verdict: the dominance check needs --all-teams» в конце; в таблице появилась колонка `median zone` | Шесть именных бригад давали ложный «FAIL» и «balance needs changes»; вердикт нужен только по всем 220 бригадам |
| 2026-11-14 | Фон зоны: контроллер `Backdrop` строит `ZoneScenery` только для текущей и уходящей зоны. Зона берётся из `sim.state.zoneIndex` каждый кадр (`Backdrop.setZone`), а не из события `zone_change`; с `?start=N` зона показывается сразу. Все слои зоны лежат в Container со `scrollFactor` 0 (дети остаются со 1: Phaser 4 перемножает множители), позиции заданы долями экрана ради логической высоты 1920–2520 | Работает дебаг-старт без события и пропуск кадров; остальные зоны не занимают память |
| 2026-11-14 | Кросс-фейд зон 1,5 с (smoothstep) делается альфой Container: новая зона проявляется поверх старой, старая остаётся на 100% до конца и удаляется. Небо зоны — запечённая полоска 4×256 (градиент по стопам `ZONE_SKY`, `gradientColorAt`), растянутая на экран; четыре слоя параллакса — запечённые тайлы 512×512 (`TileSprite`) с коэффициентами `ANIM.parallax` | Небо непрозрачное: альфой старого слоя получился бы просвет на дно; перерисовки Graphics нет |
| 2026-11-14 | Текстуры следующей зоны запекаются через 0,8 с после начала текущей, по одной за кадр: `collectBakeSteps` в `ui/bake-texture.ts` собирает шаги вместо отрисовки, `Backdrop.update` выполняет один шаг. Если зона сменилась раньше конца очереди, недостающее запекается сразу (`bakeTexture` пропускает уже созданные) | Запекание целой зоны одним куском давало подвисание посреди забега |
| 2026-11-14 | Дрейф слоёв параллакса (`tilePositionX`, пикс/с) в каждой зоне идёт в одну сторону («один ветер»), ближние слои быстрее: кухня 2/3/5/8, витрина 3/4/7/11, крыша 3/5/8/12, облака 8/14/24/40, звёзды и космос 2/3/5/8. Все значения ненулевые | Знакопеременный дрейф давал эффект сдвига вместо параллакса; движение нужно и при стоящей камере (правило «нет неподвижных объектов») |
| 2026-11-14 | Фоновая жизнь собрана из четырёх классов (`Hover`, `PuffColumn`, `Traveler`, `Twinkles`) на данных `data/backdrop-life.ts`; позы считают чистые функции `life-motion.ts`; редкие появления (муха, птицы, самолёт, комета, падающая звезда, спутник) ведёт `PassTimer`: длина прохода `moveMs`, период от старта до старта `intervalMs`, отрицательная начальная задержка значит старт внутри прохода. Падающая звезда: интервал 6–10 с, проход 650–850 мс. Скорости, периоды, амплитуды и цвета лежат в `src/data/`, геометрия рисунка остаётся в запекающих функциях как арт. Константы движения (`wobbleSide`, `flockPhase`, `twinklePhase`, `puffSwayTurns`, `puffSwayStep`) лежат в `BACKDROP_LIFE.motion`, золотое сечение `GOLDEN` в `util/math.ts` | Минимум три движущихся элемента на зону по документу 06, раздел 5; чистые позы тестируются без Phaser |
| 2026-11-14 | Кухонный прилавок вынесен в `backdrop/worktop.ts`, он мировой и есть в каждой зоне (блик по столешнице, кружка с паром, дыхание альфы 0,965–1); рисуется на `DEPTH.counter` = 4, под гало комбо (5). Ширина экрана фиксирована 1080, поэтому он рисуется один раз. Неподвижная фурнитура фона (часы, рельс, дымоход, верёвка, провод гирлянды, подставка торта) получает микро-пульс масштаба 0,8% с периодом не больше 2 с и разными фазами; небо «дышит» масштабом ±1,2% с периодом 1,8 с (`skyOverscan` 1,06) | Закрывает проверку «нет неподвижных объектов» без заметного движения |
| 2026-11-14 | Режим «меньше эффектов» фон не режет: окружающее движение остаётся, вспышек-частиц в фоне нет | Движение фона не украшение вспышками, а часть правила «нет неподвижных объектов» |
| 2026-11-14 | Плашка зоны (`ui/zone-plate.ts`) живёт в HUD-сцене и срабатывает только на повышение `RunInfo.zoneIndex` (`ZoneChangeWatch`): первая увиденная зона только база, понижение (рестарт) сбрасывает базу, с `?start=N` плашки нет. Не регистрируется в `addUiRegion`, тапы идут в забег. Висит внутри полосы HUD: нижний край пластины с тенью и наклоном не ниже `HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance` (`restY` считается в `data/zone-plate.ts`, тест `zone-plate.test.ts`), поэтому закрывает только ряд значков и не закрывает летящий слой | Первый слой новой зоны может быть рывком, а его красный контур игрок обязан увидеть |
| 2026-11-14 | Монеты и ягоды летят в счётчики HUD через game-level события `treasure:coin-fly` и `treasure:berry-pop` (`game/treasure-events.ts`) с экранными координатами: сцена забега отдаёт выплату, полёт рисует HudScene. Остальные модули трека создают текстуры лениво (`createTreasureTextures(scene)` в конструкторах, повторный вызов безопасен), а не в `BootScene`; глубины эффектов вокруг летящего слоя лежат в `fx/flying-fx-depth.ts` | У HUD своя камера без прокрутки, монета всегда над миром; не трогаем общие `boot-scene.ts` и `depth.ts` |
| 2026-11-14 | Счётчик монет показывает `state.coins` минус «ещё летящие» (`shownTotal`): каждая картинка несёт свою долю суммы, число растёт по мере прилёта. Парящая монета на посадке летит одна; монеты за комбо, идеальный бросок, крошки, золотой слой и высоту летят до 6 мелких картинок из верхнего слоя (вдвое меньше в «меньше эффектов»). Пока открыто окно паузы, полёты стоят и скрыты. Промахнувшаяся монета гаснет на отдельной паре картинок (всплытие 260 мс при паузе 220 мс до следующего слоя) | Число в итоге всегда равно `state.coins`, а число картинок ограничено |
| 2026-11-14 | Счётчик ягод стоит под счётчиком монет и появляется с первой ягодой в забеге. Идеальный золотой слой: ягода крупно в центре экрана, затем летит в счётчик ягод; обычный золотой: его 10 монет летят в счётчик монет. Звуки `coin` (один раз за шаг) и `berry` берутся из существующих методов аудио-сервиса через `fx/run-cues.ts` | Решение по заданию; нулевой счётчик ягод показывать незачем |
| 2026-11-14 | Золотой слой: отдельный индекс цвета `GOLDEN_COLOR_INDEX` (за концом таблицы) в `objects/layer-art.ts`, общий запечённый кэш слоёв; крошки и капли глазури золотые через `cakeColorsFor(..., golden)`. Цвета и числа блеска и шлейфа лежат в `data/treasure-anim.ts`; грань монеты `PALETTE.gold`, светлое золото определено один раз (`GOLD_LIGHT`). Общие `clamp01` и `smoothstep` лежат в `util/math.ts` | Не заводить новую текстурную систему; без дубликатов |
| 2026-11-14 | Красный контур рывка: запечённая текстура, растягиваемая по горизонтали (`NineSlice`, срезы только слева и справа), с пульсацией альфы и масштаба. Замах: дрожь ±6 пикселей и откат назад на 30 пикселей, затем рывок. Дрожь и откат сдвигают и `FlyingLayerView.position()`, поэтому контур, полосы скорости, покрытия способностей и золотые искры идут за картинкой; тень-подсказка остаётся на симуляционном x | Контур меняет ширину вместе со слоем, запекать под каждую ширину дорого, а `Graphics` в Phaser 4 каждый кадр перетесселируется |
| 2026-11-14 | Облако («Облака»): полоса из 11 запечённых пятен на всю ширину экрана, закреплена в мире (не едет за слоем), непрозрачна с первого кадра укрытия; направление дрейфа запоминается при приходе (60 пикселей/с, лёгкое покачивание), уходит дальше в ту же сторону, y следует строке полёта. Рисуется выше слоя и его покрытий (`flyingCoat + 4`), пока `coverMs > 0` и фаза `flying`, после броска быстро уходит (110 мс). Пока слой закрыт, скрыты тень-подсказка, взгляд лиц башни, рот «ням» верхнего слоя и блеск золотого слоя. Не использован `easeFn`: он тянет Phaser в юнит-тест `cloud-cover` | По облаку нельзя целиться, а слой скрыт всё время `coverMs`; в фазе падения `coverMs` в ядре не убывает, поэтому привязка к фазе обязательна |
| 2026-11-14 | Полосы скорости крепятся к заднему краю слоя: при рывке полный набор, на «Крыше» число и яркость идут от `windStrength(flyingSpeed / speed)` (нет у стен, полно в центре). Обманка «Звёзд»: небольшой толчок, удивлённое лицо (`gape`) и вспышка звёзд | «Ветер крыши» зависит от скорости слоя и читается без текста |
| 2026-11-14 | Плашка шкалы качки (`ui/bar-plate.ts`): один запечённый `NineSlice` (панель alpha 0,8 и тень из 6 ступеней), размер подгоняется под строку, не перерисовывается; числа в `HUD_LAYOUT.barPlate` (`padY` 10, тень 4 + 8). Подпись в опасном состоянии `HUD_LAYOUT.barDangerText` = `0xa8320a` вместо `PALETTE.danger` (контраст оранжевого на плашке 1,5–2,5:1); тест контраста в `hud-layout.test.ts` (`util/color.contrastRatio`). `badgeRowY` сдвинут 456 → 468, `bottomEdge` 510 → 522: плашка с тенью не заходит на ряд значков, это держит тест | Исправление по замечанию владельца в M5: шкалу качки нужно читать на любом фоне зон |
| 2026-11-14 | Съезжание слоя пружины «Желейки» (`slideX`) укорочено с 520 мс (`Elastic.easeOut`) до `spawnPauseMs - slideMarginMs` = 180 мс (`Back.easeOut`), чтобы цель успокоилась до появления следующего слоя. Тест `game/fx/abilities/slide-timing.test.ts` (в `src/data` нельзя: ESLint запрещает импорт ядра). Остальные приземляющие твины (сплющивание 320 мс, материалы до 640 мс, widen 240, puff 380, hop Брауни 420, подъём Двойняшек около 530) оставлены: они дольше паузы 220 мс, но меняют только масштаб или y, не x цели | Исправление по замечанию владельца в M5: цель не должна двигаться, когда игрок уже целится в следующий слой |
| 2026-11-14 | Правило «нет неподвижных объектов»: у каждого объекта экрана забега тихое покачивание (синус с периодом не больше 2000 мс, свои фазы), числа в `data/idle-motion.ts` (`IDLE_MOTION`, `IDLE_PHASE`, `IDLE_CHANNEL_LAG`, `HINT_PULSE`, `TRAY_SHEEN`), расчёт в `ui/idle-motion.ts`. Тексты HUD качаются только масштабом и углом (положение y ведёт `enterScreen`), значки эффектов и следующее существо только углом и y (масштаб «следующего» ведёт pop-твин); кнопка паузы дышит через `Button.breathe(false)` (без блика); поднос — класс `Tray` (дыхание и блик раз в 2600 мс). Слои башни дышат через контейнер `breathRoot` между `squashRoot` и `shapeRoot`, растягиваясь только вверх (`scaleY` от 1), чтобы над слоем не открывалась щель; работает при любом материале и в «меньше эффектов». Интервал морганий лиц не менялся | Движущимся считается объект, у которого меняется он сам или любой родительский контейнер; не через `LayerMaterial`, чтобы не зависеть от материала |
| 2026-11-14 | Dev-инструмент `window.tippyIdleAudit(seconds = 6)` подключается динамическим импортом только при `import.meta.env.DEV` (в продакшен-сборке его нет); чистый помощник `StillTracker` (`debug/still-watch.ts`) сравнивает с эталоном последнего изменения, поэтому медленный дрейф считается движением. Объекты без `getBounds` (Graphics) не проверяются на попадание в экран и попадают в отчёт с `boundsUnknown` | Иначе полноэкранный Graphics в (0, 0) терялся бы: у него нулевые границы |
| 2026-11-14 | Замах рывка переделан по замечанию владельца («красный контур выглядит как глюк и тормозит»): вместо дрожи ±6 пикселей раз в 50 мс плавный откат «рогаткой» (`fx/rush-windup.ts`, чистые кривые с тестами), контур проявляется за 120 мс и пульсирует раз в 700 мс. Растяжение картинки на кадр делает `FlyingLayerView.stretch()` (масштаб контейнера, `sync` сбрасывает его каждый кадр), а не масштаб `squashRoot`, который спорит с твинами появления и приземления. Облачко выстрела прижимается к экрану (`RULE_ANIM.windup.puff.screenInsetPx`) | Тряска неподвижного слоя читалась как подвисание кадра; слой рывка стартует у стены, и его задний край за экраном |
| 2026-11-14 | (заменено в части `session-wallet` в M6, см. ниже) Окно «Продолжить?» и замедление промаха живут рядом с монетами и ягодами M5: ягода рисуется один раз (`TREASURE_TEXTURES.berry`), ягоды в HUD берутся из `RunInfo.berries`, а `session-wallet` хранит только ягоды между забегами. Замедление (`fx.timeScale`) применяется ко всему, что в мире сцены (падающий слой, монеты, правила, частицы, твины, камера); HUD, фон и окно идут по реальному времени. Пока открыто окно, полёты монет и ягод в HUD прячутся и ждут (как при паузе) | Счётчики держат числа до прилёта, так что итог не теряется |
| 2026-11-14 | (заменено, см. ниже) Ягоды до M6 живут в `game/session-wallet.ts` (память сессии). Ягоды забега зачисляются, когда приходят результаты, поэтому ими нельзя оплатить продолжение этого же забега. В панели отладки кнопка «+50 berries». В M6 кошелёк переезжает в сохранение с миграцией | Сохранения до M6 нет; владелец выбрал память сессии |
| 2026-11-14 | (заменено в M6, см. ниже) Флаги подсказок (`game/session-hints.ts`) лежат в памяти сессии. Обучение незавершено, пока не сыграло вступление «Медка» или обучающий забег не прошёл слой 6: рестарт и ранний конец оставляют следующий забег обучающим. `?tutorial=1` принудительно, `?tutorial=0` отключает; без `?tutorial` любой из `?team`, `?level`, `?bot`, `?start` даёт обычный забег (без подсказок, флаги не трогаются, `skipsTutorial` в `util/debug-params.ts`). В M6 флаги переезжают в сохранение с миграцией | Не ломать ручную проверку баланса и не терять обучение при рестарте |
| 2026-11-14 | Реклама: интерфейс `AdsService` (документ 09, раздел 3) и браузерная заглушка `services/rewarded-video/web.ts`: серый DOM-экран 2 с, затем `rewarded`; режимы `reward` / `dismissed` / `unavailable` переключаются из панели отладки через `adsDev` (не входит в `Services`) | Проверять все ветки окна «Продолжить?» без SDK |
| 2026-11-14 | `AudioService.suspend/resume` принимают причину (`app` или `ad`); звук возвращается, только когда не держится ни одна причина (`audio-lifecycle.ts`) | Реклама и сворачивание приложения не должны снимать паузу друг друга |
| 2026-11-14 | Правила окна продолжения в `core/continue-offer.ts`: нет окна в башне дня, после `BALANCE.continues.max`, и когда реклама не готова и ягод не хватает; реклама только на первое продолжение; кнопка ягод (15/30) только если хватает; реклама не готова, но ягод хватает: неактивная кнопка «Реклама недоступна». Таймер 5 с стоит во время рекламы; закрытая реклама возвращает в окно; «Нет, спасибо» через 1 с; двойное касание не может и оплатить, и отказаться (`game/continue-flow.ts`). Под `?bot` окно не открывается | Чистая логика отдельно от окна, покрыта тестами |
| 2026-11-14 | Промах без щита: визуальное замедление 0,3 на 400 мс реального времени (твины, частицы, падающий слой, монеты, визуал правил, камера; HUD и фон идут по реальному времени), реакция башни 300 мс, затем окно или отказ. Промах после чиха без замедления; промах со щитом (Брауни) без окна и замедления. `ANIM.miss.fallMs` удалён, длительность `BALANCE.continues.missSlowMoMs` | Замена решения M3 от 2026-11-13 |
| 2026-11-14 | Окно «Продолжить?»: выезжает снизу, непрозрачная панель, заголовок, высота, круговой таймер (подложка запечена, дуга перерисовывается шагом 40 мс, оранжевая в последние 2 с с тиком), кнопки; кнопка паузы спрятана; окно является областью интерфейса; полёты монет в HUD ждут. Код разбит на `continue-window.ts`, `continue-timer.ts`, `continue-buttons.ts` | Файл окна не должен вырасти за ~300 строк |
| 2026-11-14 | (заменено в части праздника, см. ниже) Рекорд внутри забега (выбор владельца): пунктирная линия с флажком «Рекорд» на высоте лучшего результата сессии; при прохождении конфетти, «Рекорд!», фанфары, тройная вибрация, забег продолжается, флажок тает за 0,8 с; в забеге `?start` выше рекорда ничего не показывается. Празднование на экране результатов (M3) остаётся. Код: `fx/record-moment.ts` | Игрок видит цель во время забега, а не только в конце |
| 2026-11-14 | Обучение (документ 02, раздел 11): слои 1–3 со скоростью ×0,6; допуск ≥ 30 после 8 слоёв без идеального до первого идеального; бригада «Медок» уровня 1 в слоте 1; рука и «Нажми!» над рядом летящих слоёв до первого броска; первый идеальный за сессию: «Идеально!» и вспышка (без вспышки в режиме «меньше эффектов»); слой 6 «Медок»: симуляция стоит 1,5 с, касания игнорируются, стрелка и подпись «{имя} прилипает...» (плашка уходит под слой, если под HUD нет места); подсказка качки один раз за сессию при качке > 30 в любом забеге (плашка на башне, на 40 px ниже верхней поверхности, ~3,4 с); часы подсказок стоят на паузе. Шаг 5 (Home с подсвеченной «Играть») ждёт M6, аналитика `tutorial_step` / `tutorial_complete` ждёт M8. Код: `game/tutorial/`, числа в `data/tutorial-anim.ts` | Подсказки не должны закрывать ряд летящих слоёв |
| 2026-11-14 | Рефакторинг: кэш запечённой картинки слоя вынесен из `LayerView` в `objects/layer-art-slot.ts`, пружинный твин масштаба в `fx/spring-back.ts`; математика прокрутки камеры (`trayScrollY`, `targetScrollY`, `FLYING_REACH`) в `game/camera-layout.ts` с тестами; ESLint и Prettier игнорируют `.claude` (временные рабочие копии), ESLint задаёт `tsconfigRootDir` | Ограничение ~300 строк на файл и повторное использование |
| 2026-11-14 | Смягчение поздних зон по решению владельца (вариант 1 из сравнения): Крыша 0,8 у краёв и 1,0 в центре вместо 1,2, облака 35% на проход, 200–350 мс, приходят на 5–30% пути, множители скорости Крыши и Облаков 1,0, Звёзд 1,05 (`data/zones.ts`). Модель бота не менялась: коэффициент ×1,5 к ошибке под облаком (`DIFFICULTY.cloudSdMult`) и лёгкость «Крыши» для бота (он сразу учитывает мгновенную скорость профиля) надо проверить на живых игроках | С первоначальными числами медиана опытного без бригады упала с 84 до 68: забеги кончались в Облаках (68%), до Звёзд доходили 14%. По отдельности без зон 83, только множители скорости 79, только Крыша 75, только Облака 77, Витрина 82, Звёзды 83 |
| 2026-11-14 | Исключение, утверждённое владельцем: бригада «Медок, Пышка, Брауни» на обычном профиле даёт +51,5% медианы (50 при базе 33, на полслоя выше границы +50%) после смягчения Крыши. Считается шумом и не правится; существ и «Крышу» не трогать | Прогон `npm run sim --all-teams` 2026-11-14 с вариантом 1 зон |
| 2026-11-14 | Граница «свыше +50%» в `npm run sim` считается с допуском 3 процентных пункта (`GAIN_OVER_TOLERANCE_PP` в `scripts/sim.ts`): бригада проваливает критерий, только если её прирост больше +53% | Решение владельца: не останавливаться на шуме 2000 забегов (один слой у обычного профиля около 3 п. п.) |
| 2026-11-14 | (заменено в M6, см. ниже) Ягоды, заработанные в забеге, сразу попадают в кошелёк сессии (`game/session-wallet.ts`), а не на экране результатов; монеты и ягоды остаются у игрока при любом исходе забега. Заменяет строку выше про зачисление ягод по приходу результатов. В M6 кошелёк переезжает в сохранение с миграцией | Решение владельца: заработанной в забеге ягодой можно оплатить продолжение этого же забега |
| 2026-11-14 | Рекорд празднуется один раз в полную силу: в забеге при пробое линии короткая вспышка, конфетти и «Рекорд!» с коротким звуком, без фанфар и без остановки; полный праздник с лентой и фанфарами только на экране результатов. Заменяет часть строки выше про фанфары и тройную вибрацию в забеге | Решение владельца: двойной праздник подряд ослаблял эффект |
| 2026-11-14 | Частичный обвал башни внутри забега (после промаха рушится часть, игра идёт дальше) не делается | Дублирует окно «Продолжить?» и щит «Брауни»: игрок уже получает вторую попытку этими двумя способами |
| 2026-11-14 | Старт с контрольной точки (слои 20…100, платный: реклама или ягоды, с нуля бесплатно, не в башне дня) спроектирован: `02-gameplay.md`, раздел 10, `05-economy-monetization.md`, `07-ui-screens.md`, раздел 2.1. Реализация в этапе M6b (после M6: нужны Home и сохранение). Нужны: `RunConfig.startHeight`, таблица стартовых ширин в `data/` по медианам `npm run sim`, поле достигнутых точек в сохранении с миграцией | Решение владельца; цены ягод пока предложение |
| 2026-11-14 | Старт с контрольной точки: владелец утвердил цены 5 / 10 / 15 / 25 / 40 ягод, рекламу для точек 20, 40, 60 (не больше 5 в день) и все допущения (точка открывается по достигнутой высоте в Классике, плата в момент старта, бонус высоты, опыт пекаря и задания только за положенные слои, плашка зоны на старте не показывается). После забега с точки на результатах есть кнопка «С точки N» с ценой. Код в M6b | Решение владельца |
| 2026-11-14 | Вымпел «Рекорд» нарисован отдельно от линии, над башней (`DEPTH.recordPennant`, ниже тени-подсказки и летящего слоя) и стоит у того края, где рядом с башней на высоте рекорда больше места (`fx/pennant-side.ts`, переход на другую сторону с запасом `CONTINUE_ANIM.flag.sideHysteresis`) | Под башней у правого края его закрывали слои: читалось только «орд» |
| 2026-11-14 | Подтёки глазури растут после приземления слоя: запечённая текстура не перерисовывается, поверх неё лежат маленькие окрашенные картинки (`objects/glaze-drip-layer.ts`), время приземления хранится по номеру слоя (`objects/glaze-drip-growth.ts`), числа в `data/glaze-drips.ts`, чистая математика с тестами в `fx/glaze-growth.ts`. Описание в `06-art-animation-audio.md`, раздел 3 | Растить подтёки перерисовкой текстуры слоя дорого (новая текстура на каждый кадр роста); так стоимость слоя без роста нулевая, а слой, вернувшийся из пула, не начинает рост заново |
| 2026-11-14 | Старт страницы: ожидание шрифта Nunito ограничено `BOOT.fontWaitMs` (3 с, `data/boot.ts`), дальше игра стартует с запасным шрифтом; у `@font-face` кроме `format('woff2-variations')` есть `format('woff2')` того же файла. В dev-сборке `index.html` выводит ошибки запуска прямо на экран (ошибки скриптов, необработанные промисы, сбои загрузки файлов), а через 8 и 30 с без холста пишет последний шаг запуска (`window.__bootStage` из `main.ts`) и последние загруженные файлы. Для игры с телефона по Wi-Fi удобнее сжатая сборка: `npm run build`, затем `npx vite preview --host` | На iPhone (iOS 18, Safari) по адресу в локальной сети был белый экран без сообщений: на телефоне нет консоли, а в режиме разработки Phaser весит 7 МБ без сжатия |
| 2026-11-14 | Dev-сервер отдаёт Phaser его собственной минифицированной ES-сборкой `phaser/dist/phaser.esm.min.js` без карты исходников: в `vite.config.ts` только для `vite` в режиме разработки импорт `phaser` направлен на этот файл, Phaser исключён из предсборки (`optimizeDeps.exclude`), а плагин `lean-dev-phaser` отдаёт файл с пустой картой, чтобы Vite не сгенерировал и не вшил свою. Сборка и тесты не меняются (`npm run build` даёт тот же файл) | По умолчанию Vite предсобирает Phaser и вшивает его карту исходников в base64: около 21 МБ на один модуль, телефон по Wi-Fi грузил страницу разработки очень долго. Теперь весь код страницы в режиме разработки около 3,8 МБ. Белый экран на iPhone был не из-за этого, см. следующую строку |
| 2026-11-14 | Белый экран на iPhone в режиме разработки («Failed to load: /src/main.ts») вызывал блокировщик контента Safari: он режет адреса с `ads` (`/src/services/ads/web.ts`, `/src/data/ads.ts`), а в режиме разработки каждый модуль грузится отдельным запросом, и один заблокированный модуль ломает всю загрузку. Сжатая сборка (`npm run build`) собрана в один файл и от этого не страдает. Для проверок с телефона в режиме разработки блокировщики контента в Safari надо выключить. В dev-сборке `index.html` дополнительно делает `import('/src/main.ts')` и показывает на экране причину, если модуль не загрузился | Сервер отвечал на все запросы телефона кодами 200/304, а движок WebKit на компьютере страницу открывал; телефон каждый раз останавливался на 206 модулях из 270 |
| 2026-11-14 | В критерии M8 добавлена проверка с DNS-блокировщиком рекламы: домены AdMob, Firebase и RevenueCat недоступны, игра работает, реклама «недоступна», аналитика молча не отправляется, покупки показывают понятную ошибку, необработанных исключений нет | Решение владельца после белого экрана на iPhone из-за блокировщика контента Safari (AdGuard): блокировщики встречаются у игроков, сервисы обязаны переживать недоступность своих доменов |
| 2026-11-14 | Цепочка миграций подставляется в `migrate(raw, chain, target)`: тест проверяет каждый шаг без настоящей второй версии. Сохранение более новой версии не открывается и не переписывается: оно остаётся как `save_corrupt_<время>`, игра берёт копию или начинает заново | Старое приложение не должно портить сохранение новой версии |
| 2026-11-14 | Результат покупок и прокачки: `EconomyResult<T, R> = { ok: true; value: T } \| { ok: false; reason: R }`; `spend` возвращает новый кошелёк или `null`, исходный объект не меняется | Причина отказа нужна окнам (не хватает, уже куплено, закрыто) |
| 2026-11-14 | Время только через `util/clock.ts`: `now()` (системные часы плюс `?dayOffset` в dev), `localDay`, `utcDay`, `clockWentBack`; допуск 10 минут лежит в `data/clock.ts`. `lastSeenAt` только растёт: часы, переведённые назад, остаются заметными и после перезапуска | `Date.now()` в коде вне `util/clock.ts` не используется |
| 2026-11-14 | Монеты забега попадают в сохранение, когда забег кончился (`gameState.recordRun`, по событию `run_over`, любой исход), ягоды сразу при получении. Выход из идущего забега («Заново» в паузе, перезапуск из панели отладки) записывается как `endReason: 'quit'` один раз (`TowerSim.quitResult()`, `RunRecorder`), без бонуса за высоту; забег без заработка не считается | Решение владельца: монеты и ягоды остаются у игрока при любом исходе забега (заменяет прежнее «монеты не засчитываются») |
| 2026-11-14 | Загрузка сохранения ждёт не дольше `BOOT.saveWaitMs`; по таймауту игра идёт на новом сохранении в памяти без записи в хранилище, поздний результат чтения отбрасывается (`load({ timeoutMs })` → `'loaded' \| 'timeout'`) | Зависшее чтение не должно позволить новому сохранению затереть настоящее |
| 2026-11-14 | `settings.reducedFx` равен `'auto'`, `'on'` или `'off'`: выбор игрока важнее системного «Уменьшения движения» и автоматического переключения по частоте кадров; касание выключателя всегда даёт явный `on` или `off` | Решение владельца |
| 2026-11-14 | Первый забег игрока за всё время рекордом не считается (`stats.runs === 0`), последующие сравниваются с сохранённым `records.classicHeight`; линия рекорда в забеге берёт то же значение (`gameState.recordHeight`, `null` до первого забега) | Решение владельца |
| 2026-11-14 | `installId` строится из `crypto.getRandomValues` (`util/install-id.ts`), а не `randomUUID`: на http (телефон в локальной сети) `randomUUID` недоступен | Решение владельца |
| 2026-11-14 | Отладочные подмены (`?tutorial=1/0`, `?team`, `?level`, `?bot`, `?start`, `?dayOffset`) не пишутся в сохранение: `?tutorial=1` ведёт свежие подсказки в памяти страницы, `?tutorial=0` считает все подсказки показанными и ничего не отмечает. Правило «`?team/?level/?bot/?start` без `?tutorial` дают обычный забег» осталось | Решение владельца |
| 2026-11-14 | Модули `game/session-wallet.ts`, `game/session-hints.ts`, `game/session-record.ts` заменены `state/game-state.ts` (ягоды, подсказки, рекорд). `berriesFromEvents` переехал в `core/berries.ts`, бригада обучения в `game/tutorial/tutorial-team.ts`, выключатели паузы и применение настроек при старте в `game/apply-settings.ts`. Хранилище: `services/storage` (`WebStorage` на localStorage с запасом в памяти страницы, чтобы приватный режим не ломал игру) | Правило «без дубликатов» и этап M6 |
| 2026-11-14 | Чтение сохранения, которое бросило исключение, не то же самое, что пустой ключ: `load` возвращает `{ status: 'read_failed' }`, игра идёт на новом сохранении в памяти без записи в хранилище (как при таймауте), в консоли предупреждение | Иначе сбой чтения приводил к новому сохранению, которое затирало настоящее, а потом и копию |
| 2026-11-14 | Зависимость `GameState` от часов называется `realNow` (настоящие системные часы): `lastSeenAt` и проверка отката часов не должны идти за `?dayOffset=` (иначе после запуска со сдвигом +8 обычный старт видел бы часы отставшими на 8 дней, а отрицательный сдвиг срабатывал бы сразу). Функции игры читают `now()` со сдвигом | Ревью M6 |
| 2026-11-14 | Закрытие страницы (`pagehide`) посреди забега считается выходом из него: монеты забега записываются и сохранение сбрасывается на диск; уход в фон не считается. Возврат из кэша страницы после этого начинает новый забег | Правило владельца «монеты остаются у игрока при любом исходе» и критерий M6 «перезагрузка в любой момент не теряет прогресс» (`SHUTDOWN` на `pagehide` не приходит) |
| 2026-11-14 | Сохранение текущей версии с отсутствующими или неверными ключевыми полями считается повреждённым, если есть целая копия (берётся копия, поломанный текст остаётся в `save_corrupt_*`); без целой копии чинится поле за полем. Оба непригодных текста сохраняются каждый под своим ключом | Раньше мусор в `coins` и подобных полях молча обнулял прогресс и побеждал годную копию |
| 2026-11-14 | Забеги `?bot=` и `?start=` в сохранение не пишутся, забеги `?team=` и `?level=` пишутся | Решение владельца: бот и старт с высоты искусственные, а проверка существ должна быть настоящей |
| 2026-11-14 | Запись после неудачи повторяется не чаще раза в `SAVE_RETRY_MS` (5 с, `data/storage.ts`); `bakerLevel` ограничен `MAX_BAKER_LEVEL` (1000, `data/progression.ts`) | Без повтора неудавшаяся запись ждала следующего изменения; подделанный опыт замораживал первый забег |
| 2026-11-14 | Награда-существо, которое уже есть, заменяется половиной цены в валюте магазина, при двух ценах в монетах (`duplicateCompensation`, `grantCreature` в `core/economy.ts`, доля `DUPLICATE_CREATURE_SHARE` в `data/economy.ts`). `LevelUp` в итоге забега несёт поле `duplicate` (что выдано вместо существа или `null`) для экрана награды. Стартовый набор не трогается: у него своё правило (1200 монет) | Решение владельца: «Радужка» на 20-м уровне у купившего её даёт 300 ягод |
| 2026-11-14 | Пути модулей без слов, которые ловят блокировщики контента (`ads`, `advert`, `banner`, `sponsor`, `track`, `analytics`, `counter`): `services/ads/` → `services/rewarded-video/`, `services/analytics/` → `services/telemetry/`, `data/ads.ts` → `data/rewarded-video.ts`, `zone-banner.ts` → `zone-plate.ts` (данные, интерфейс, тест), `debug/still-tracker.ts` → `debug/still-watch.ts`, `backdrop/counter.ts` → `backdrop/worktop.ts`, `ui/resource-counter.ts` → `ui/resource-tally.ts`; будущий `core/ads-policy.ts` называется `core/video-policy.ts`. Имена типов и классов (`AdsService`, `ZoneBanner`, `ResourceCounter`) не менялись: блокировщики смотрят только адреса. Правило записано в `CLAUDE.md` | Блокировщик в Safari (AdGuard) резал модули из `src/services/ads` в режиме разработки, и игра при первом открытии падала. Проверено в Chromium с фильтром, блокирующим адреса с `/ads/`, `/ads.`, `/analytics/`, `banner`, `track`, `counter`: игра загружается без ошибок |
