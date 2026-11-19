# 8а. Таблица переноса файлов (сессия 6в)

Раскладка файлов по темам внутри слоёв (идея 38, `12-ideas-backlog.md`). Правила и список тем: `08-architecture.md`, раздел 2. Менялись только пути: имена файлов, классов и функций те же. Метка `pre-reorg` в git стоит на последнем коммите до переноса; история файла видна через `git log --follow <новый путь>`.

Столбец «Почему» заполнен там, где файл подходил двум темам: он идёт туда, откуда его чаще импортируют.

Не переносились: `src/game/scenes`, `src/game/debug`, `src/game/perf`, `src/game/tutorial`, `src/game/fx/abilities`, `src/game/ui/style`, `src/core/save`, `src/core/abilities`, `src/state`, `src/util`, `src/services`, `src/i18n`, корень `src`. Папка `src/game/objects/creature-art` переехала целиком в `src/game/objects/creatures/creature-art`.

Всего перенесено 777 файлов.

## src/data (106)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/data/ability-anim.ts` | `src/data/creatures/ability-anim.ts` |  |
| `src/data/anim.ts` | `src/data/common/anim.ts` |  |
| `src/data/app-info.test.ts` | `src/data/app/app-info.test.ts` |  |
| `src/data/app-info.ts` | `src/data/app/app-info.ts` |  |
| `src/data/art-sheet.ts` | `src/data/debug/art-sheet.ts` |  |
| `src/data/audio-mix.ts` | `src/data/audio/audio-mix.ts` |  |
| `src/data/backdrop-colors.ts` | `src/data/backdrop/backdrop-colors.ts` |  |
| `src/data/backdrop-far.test.ts` | `src/data/backdrop/backdrop-far.test.ts` |  |
| `src/data/backdrop-far.ts` | `src/data/backdrop/backdrop-far.ts` |  |
| `src/data/backdrop-life.ts` | `src/data/backdrop/backdrop-life.ts` |  |
| `src/data/backdrop-mountains.ts` | `src/data/backdrop/backdrop-mountains.ts` |  |
| `src/data/backdrop.ts` | `src/data/backdrop/backdrop.ts` |  |
| `src/data/balance.ts` | `src/data/tower/balance.ts` |  |
| `src/data/bar-look.ts` | `src/data/common/bar-look.ts` |  |
| `src/data/berry-look.ts` | `src/data/economy/berry-look.ts` |  |
| `src/data/boot.ts` | `src/data/app/boot.ts` |  |
| `src/data/checkpoint-look.ts` | `src/data/zones/checkpoint-look.ts` |  |
| `src/data/checkpoints.ts` | `src/data/zones/checkpoints.ts` |  |
| `src/data/chest-look.ts` | `src/data/economy/chest-look.ts` |  |
| `src/data/clip-guard.ts` | `src/data/debug/clip-guard.ts` | страж обрезки работает только на листе ?artsheet=1 |
| `src/data/clock.ts` | `src/data/app/clock.ts` |  |
| `src/data/continue-anim.ts` | `src/data/run/continue-anim.ts` |  |
| `src/data/creature-looks.ts` | `src/data/creatures/creature-looks.ts` |  |
| `src/data/creature-materials.ts` | `src/data/creatures/creature-materials.ts` |  |
| `src/data/creature-style.ts` | `src/data/creatures/creature-style.ts` |  |
| `src/data/creatures.test.ts` | `src/data/creatures/creatures.test.ts` |  |
| `src/data/creatures.ts` | `src/data/creatures/creatures.ts` |  |
| `src/data/cut-look.ts` | `src/data/cuts/cut-look.ts` |  |
| `src/data/daily.ts` | `src/data/progression/daily.ts` |  |
| `src/data/demo.ts` | `src/data/run/demo.ts` |  |
| `src/data/economy.ts` | `src/data/economy/economy.ts` |  |
| `src/data/edge-squash.ts` | `src/data/tower/edge-squash.ts` |  |
| `src/data/effect-levels.ts` | `src/data/app/effect-levels.ts` |  |
| `src/data/first-runs.ts` | `src/data/economy/first-runs.ts` | первые забеги без продаж; читают правила экономики |
| `src/data/flight-clear.ts` | `src/data/backdrop/flight-clear.ts` | путники фона держатся в стороне от летящего слоя; читают фон и погода |
| `src/data/fps-meter.ts` | `src/data/debug/fps-meter.ts` |  |
| `src/data/gift-look.ts` | `src/data/economy/gift-look.ts` |  |
| `src/data/gift.ts` | `src/data/economy/gift.ts` |  |
| `src/data/glaze-drips.ts` | `src/data/glaze/glaze-drips.ts` |  |
| `src/data/haptics.ts` | `src/data/app/haptics.ts` | отклик устройства, не звук; настройки приложения |
| `src/data/hop-motion.ts` | `src/data/common/hop-motion.ts` |  |
| `src/data/hud-layout.test.ts` | `src/data/run/hud-layout.test.ts` |  |
| `src/data/hud-layout.ts` | `src/data/run/hud-layout.ts` | HUD забега; читают сцена HUD, обучение и камера |
| `src/data/iap-stub.ts` | `src/data/economy/iap-stub.ts` |  |
| `src/data/idle-motion.test.ts` | `src/data/common/idle-motion.test.ts` |  |
| `src/data/idle-motion.ts` | `src/data/common/idle-motion.ts` |  |
| `src/data/kitchen-ladles.test.ts` | `src/data/backdrop/kitchen-ladles.test.ts` |  |
| `src/data/lap-edge.ts` | `src/data/zones/lap-edge.ts` |  |
| `src/data/lick.ts` | `src/data/glaze/lick.ts` |  |
| `src/data/lineup.ts` | `src/data/debug/lineup.ts` |  |
| `src/data/master-anim.ts` | `src/data/creatures/master-anim.ts` |  |
| `src/data/mastery-look.ts` | `src/data/creatures/mastery-look.ts` |  |
| `src/data/mastery.ts` | `src/data/creatures/mastery.ts` |  |
| `src/data/menu-layout.ts` | `src/data/common/menu-layout.ts` | раскладка всех экранов меню сразу, а не одного экрана |
| `src/data/missions.ts` | `src/data/progression/missions.ts` |  |
| `src/data/music.ts` | `src/data/audio/music.ts` |  |
| `src/data/offline-look.ts` | `src/data/economy/offline-look.ts` |  |
| `src/data/oven-look.ts` | `src/data/economy/oven-look.ts` |  |
| `src/data/palette.ts` | `src/data/common/palette.ts` |  |
| `src/data/panorama-pieces.test.ts` | `src/data/weather/panorama-pieces.test.ts` |  |
| `src/data/perf.ts` | `src/data/debug/perf.ts` | новая тема debug (замер), как папки game/debug и game/perf |
| `src/data/picture-fields.ts` | `src/data/common/picture-fields.ts` |  |
| `src/data/plain-layers.ts` | `src/data/tower/plain-layers.ts` |  |
| `src/data/plain-toppers.test.ts` | `src/data/toppers/plain-toppers.test.ts` |  |
| `src/data/plain-toppers.ts` | `src/data/toppers/plain-toppers.ts` |  |
| `src/data/progression.ts` | `src/data/progression/progression.ts` |  |
| `src/data/rainbow-look.ts` | `src/data/creatures/rainbow-look.ts` |  |
| `src/data/rarity.ts` | `src/data/creatures/rarity.ts` |  |
| `src/data/results-demo.ts` | `src/data/debug/results-demo.ts` |  |
| `src/data/reward-look.ts` | `src/data/economy/reward-look.ts` |  |
| `src/data/rewarded-video.ts` | `src/data/economy/rewarded-video.ts` |  |
| `src/data/rule-anim.ts` | `src/data/zones/rule-anim.ts` | вид правил зон (рывок, полосы, облако, обманка); читает fx/zones |
| `src/data/save-defaults.ts` | `src/data/app/save-defaults.ts` |  |
| `src/data/screen.ts` | `src/data/app/screen.ts` |  |
| `src/data/sfx-life.test.ts` | `src/data/audio/sfx-life.test.ts` |  |
| `src/data/sfx-life.ts` | `src/data/audio/sfx-life.ts` |  |
| `src/data/sfx.ts` | `src/data/audio/sfx.ts` |  |
| `src/data/share.ts` | `src/data/run/share.ts` |  |
| `src/data/shared-atlas.test.ts` | `src/data/common/shared-atlas.test.ts` |  |
| `src/data/shared-atlas.ts` | `src/data/common/shared-atlas.ts` |  |
| `src/data/shop.ts` | `src/data/economy/shop.ts` |  |
| `src/data/sim-teams.ts` | `src/data/debug/sim-teams.ts` |  |
| `src/data/soak.ts` | `src/data/debug/soak.ts` |  |
| `src/data/sound-trim.ts` | `src/data/audio/sound-trim.ts` |  |
| `src/data/space-planets.ts` | `src/data/zones/space-planets.ts` |  |
| `src/data/space-visitor.ts` | `src/data/guests/space-visitor.ts` | гость «Космоса»; читает и backdrop/space |
| `src/data/start-places.ts` | `src/data/zones/start-places.ts` | первая зона забега (кухня или магазин); читают зоны фона |
| `src/data/storage.ts` | `src/data/app/storage.ts` |  |
| `src/data/streak.ts` | `src/data/progression/streak.ts` |  |
| `src/data/street-weather.ts` | `src/data/weather/street-weather.ts` |  |
| `src/data/topper-squash.ts` | `src/data/toppers/topper-squash.ts` |  |
| `src/data/tower-guest.ts` | `src/data/guests/tower-guest.ts` |  |
| `src/data/tower-sparkles.ts` | `src/data/tower/tower-sparkles.ts` | искорки у башни; читает только fx/tower |
| `src/data/tower-weather.ts` | `src/data/weather/tower-weather.ts` |  |
| `src/data/transform-scene.ts` | `src/data/creatures/transform-scene.ts` |  |
| `src/data/treasure-anim.ts` | `src/data/economy/treasure-anim.ts` |  |
| `src/data/treasure-piles.ts` | `src/data/economy/treasure-piles.ts` |  |
| `src/data/tutorial-anim.ts` | `src/data/tutorial/tutorial-anim.ts` | новая тема tutorial, как папка game/tutorial |
| `src/data/video-icon-look.ts` | `src/data/economy/video-icon-look.ts` |  |
| `src/data/weather-bed.ts` | `src/data/audio/weather-bed.ts` | звук погоды; services/audio читает его чаще, чем фон |
| `src/data/weather-look.ts` | `src/data/weather/weather-look.ts` |  |
| `src/data/weather.ts` | `src/data/weather/weather.ts` |  |
| `src/data/window-look.ts` | `src/data/weather/window-look.ts` |  |
| `src/data/zone-plate.test.ts` | `src/data/zones/zone-plate.test.ts` |  |
| `src/data/zone-plate.ts` | `src/data/zones/zone-plate.ts` |  |
| `src/data/zones.ts` | `src/data/zones/zones.ts` |  |

## src/core (97)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/core/ability-values.test.ts` | `src/core/creatures/ability-values.test.ts` |  |
| `src/core/ability-values.ts` | `src/core/creatures/ability-values.ts` |  |
| `src/core/berries.test.ts` | `src/core/economy/berries.test.ts` |  |
| `src/core/berries.ts` | `src/core/economy/berries.ts` |  |
| `src/core/bot.test.ts` | `src/core/tower/bot.test.ts` |  |
| `src/core/bot.ts` | `src/core/tower/bot.ts` | бот игрока для симуляции; импортируют тесты tower-sim |
| `src/core/checkpoints.test.ts` | `src/core/zones/checkpoints.test.ts` |  |
| `src/core/checkpoints.ts` | `src/core/zones/checkpoints.ts` |  |
| `src/core/coins.test.ts` | `src/core/economy/coins.test.ts` |  |
| `src/core/coins.ts` | `src/core/economy/coins.ts` |  |
| `src/core/collection.test.ts` | `src/core/progression/collection.test.ts` |  |
| `src/core/collection.ts` | `src/core/progression/collection.ts` | коллекция относится к progression |
| `src/core/continue-offer.test.ts` | `src/core/run/continue-offer.test.ts` |  |
| `src/core/continue-offer.ts` | `src/core/run/continue-offer.ts` |  |
| `src/core/daily.test.ts` | `src/core/progression/daily.test.ts` |  |
| `src/core/daily.ts` | `src/core/progression/daily.ts` |  |
| `src/core/day-count.ts` | `src/core/progression/day-count.ts` |  |
| `src/core/double-coins.test.ts` | `src/core/economy/double-coins.test.ts` |  |
| `src/core/double-coins.ts` | `src/core/economy/double-coins.ts` |  |
| `src/core/drop.test.ts` | `src/core/tower/drop.test.ts` |  |
| `src/core/drop.ts` | `src/core/tower/drop.ts` |  |
| `src/core/economy.test.ts` | `src/core/economy/economy.test.ts` |  |
| `src/core/economy.ts` | `src/core/economy/economy.ts` |  |
| `src/core/field.test.ts` | `src/core/tower/field.test.ts` |  |
| `src/core/field.ts` | `src/core/tower/field.ts` |  |
| `src/core/first-runs.test.ts` | `src/core/economy/first-runs.test.ts` |  |
| `src/core/first-runs.ts` | `src/core/economy/first-runs.ts` | импортируют shop, video-policy и continue-offer |
| `src/core/flight.test.ts` | `src/core/tower/flight.test.ts` |  |
| `src/core/flight.ts` | `src/core/tower/flight.ts` |  |
| `src/core/gift.test.ts` | `src/core/economy/gift.test.ts` |  |
| `src/core/gift.ts` | `src/core/economy/gift.ts` |  |
| `src/core/landing-preview.test.ts` | `src/core/tower/landing-preview.test.ts` | проверяет tower-sim |
| `src/core/mastery.test.ts` | `src/core/creatures/mastery.test.ts` |  |
| `src/core/mastery.ts` | `src/core/creatures/mastery.ts` |  |
| `src/core/miss.ts` | `src/core/tower/miss.ts` |  |
| `src/core/missions.test.ts` | `src/core/progression/missions.test.ts` |  |
| `src/core/missions.ts` | `src/core/progression/missions.ts` |  |
| `src/core/near-miss.test.ts` | `src/core/run/near-miss.test.ts` |  |
| `src/core/near-miss.ts` | `src/core/run/near-miss.ts` |  |
| `src/core/oven.test.ts` | `src/core/economy/oven.test.ts` |  |
| `src/core/oven.ts` | `src/core/economy/oven.ts` |  |
| `src/core/progression.test.ts` | `src/core/progression/progression.test.ts` |  |
| `src/core/progression.ts` | `src/core/progression/progression.ts` |  |
| `src/core/record-unlocks.test.ts` | `src/core/progression/record-unlocks.test.ts` |  |
| `src/core/record-unlocks.ts` | `src/core/progression/record-unlocks.ts` |  |
| `src/core/rng.test.ts` | `src/core/common/rng.test.ts` |  |
| `src/core/rng.ts` | `src/core/common/rng.ts` |  |
| `src/core/run-coins.ts` | `src/core/economy/run-coins.ts` |  |
| `src/core/run-look.test.ts` | `src/core/weather/run-look.test.ts` |  |
| `src/core/run-look.ts` | `src/core/weather/run-look.ts` | выбирает погоду и место старта забега |
| `src/core/run-result.test.ts` | `src/core/run/run-result.test.ts` |  |
| `src/core/run-result.ts` | `src/core/run/run-result.ts` |  |
| `src/core/run-tally.test.ts` | `src/core/run/run-tally.test.ts` |  |
| `src/core/run-tally.ts` | `src/core/run/run-tally.ts` |  |
| `src/core/scoring.test.ts` | `src/core/tower/scoring.test.ts` |  |
| `src/core/scoring.ts` | `src/core/tower/scoring.ts` |  |
| `src/core/shop.test.ts` | `src/core/economy/shop.test.ts` |  |
| `src/core/shop.ts` | `src/core/economy/shop.ts` |  |
| `src/core/sim-test-utils.ts` | `src/core/tower/sim-test-utils.ts` |  |
| `src/core/sim-types.ts` | `src/core/tower/sim-types.ts` |  |
| `src/core/space-laps.test.ts` | `src/core/zones/space-laps.test.ts` |  |
| `src/core/space-laps.ts` | `src/core/zones/space-laps.ts` |  |
| `src/core/space-planet.test.ts` | `src/core/zones/space-planet.test.ts` |  |
| `src/core/space-planet.ts` | `src/core/zones/space-planet.ts` | планеты витков «Космоса» (zones) |
| `src/core/space-visitor-pick.test.ts` | `src/core/guests/space-visitor-pick.test.ts` |  |
| `src/core/space-visitor-pick.ts` | `src/core/guests/space-visitor-pick.ts` | гость «Космоса» (guests), а не фон |
| `src/core/speed-curve.test.ts` | `src/core/tower/speed-curve.test.ts` |  |
| `src/core/speed-curve.ts` | `src/core/tower/speed-curve.ts` |  |
| `src/core/streak.test.ts` | `src/core/progression/streak.test.ts` |  |
| `src/core/streak.ts` | `src/core/progression/streak.ts` |  |
| `src/core/team-place.test.ts` | `src/core/creatures/team-place.test.ts` |  |
| `src/core/team-place.ts` | `src/core/creatures/team-place.ts` |  |
| `src/core/team-queue.test.ts` | `src/core/creatures/team-queue.test.ts` |  |
| `src/core/team-queue.ts` | `src/core/creatures/team-queue.ts` |  |
| `src/core/team.test.ts` | `src/core/creatures/team.test.ts` |  |
| `src/core/team.ts` | `src/core/creatures/team.ts` |  |
| `src/core/tempo-ease.test.ts` | `src/core/tower/tempo-ease.test.ts` |  |
| `src/core/tempo-ease.ts` | `src/core/tower/tempo-ease.ts` |  |
| `src/core/tower-sim-checkpoint.test.ts` | `src/core/tower/tower-sim-checkpoint.test.ts` |  |
| `src/core/tower-sim-field.test.ts` | `src/core/tower/tower-sim-field.test.ts` |  |
| `src/core/tower-sim-mastery.test.ts` | `src/core/tower/tower-sim-mastery.test.ts` |  |
| `src/core/tower-sim-space-laps.test.ts` | `src/core/tower/tower-sim-space-laps.test.ts` |  |
| `src/core/tower-sim-speed-scale.test.ts` | `src/core/tower/tower-sim-speed-scale.test.ts` |  |
| `src/core/tower-sim-team.test.ts` | `src/core/tower/tower-sim-team.test.ts` |  |
| `src/core/tower-sim-tempo-ease.test.ts` | `src/core/tower/tower-sim-tempo-ease.test.ts` |  |
| `src/core/tower-sim-tutorial.test.ts` | `src/core/tower/tower-sim-tutorial.test.ts` |  |
| `src/core/tower-sim-zones.test.ts` | `src/core/tower/tower-sim-zones.test.ts` |  |
| `src/core/tower-sim.test.ts` | `src/core/tower/tower-sim.test.ts` |  |
| `src/core/tower-sim.ts` | `src/core/tower/tower-sim.ts` |  |
| `src/core/video-policy.test.ts` | `src/core/economy/video-policy.test.ts` |  |
| `src/core/video-policy.ts` | `src/core/economy/video-policy.ts` |  |
| `src/core/weighted-pick.test.ts` | `src/core/common/weighted-pick.test.ts` |  |
| `src/core/weighted-pick.ts` | `src/core/common/weighted-pick.ts` |  |
| `src/core/wobble.test.ts` | `src/core/tower/wobble.test.ts` |  |
| `src/core/wobble.ts` | `src/core/tower/wobble.ts` |  |
| `src/core/zones.test.ts` | `src/core/zones/zones.test.ts` |  |
| `src/core/zones.ts` | `src/core/zones/zones.ts` |  |

## src/game/fx (119)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/game/fx/anim-curves.test.ts` | `src/game/fx/common/anim-curves.test.ts` |  |
| `src/game/fx/anim-curves.ts` | `src/game/fx/common/anim-curves.ts` |  |
| `src/game/fx/berry-texture.ts` | `src/game/fx/economy/berry-texture.ts` |  |
| `src/game/fx/camera-kick.test.ts` | `src/game/fx/run/camera-kick.test.ts` |  |
| `src/game/fx/camera-kick.ts` | `src/game/fx/run/camera-kick.ts` | толчок вида забега; импортирует только run-fx |
| `src/game/fx/checkpoint-textures.ts` | `src/game/fx/zones/checkpoint-textures.ts` |  |
| `src/game/fx/chest-texture.ts` | `src/game/fx/economy/chest-texture.ts` |  |
| `src/game/fx/cloud-cover.test.ts` | `src/game/fx/zones/cloud-cover.test.ts` |  |
| `src/game/fx/cloud-cover.ts` | `src/game/fx/zones/cloud-cover.ts` |  |
| `src/game/fx/cloud-figure.test.ts` | `src/game/fx/zones/cloud-figure.test.ts` |  |
| `src/game/fx/cloud-figure.ts` | `src/game/fx/zones/cloud-figure.ts` |  |
| `src/game/fx/coin-flight-math.test.ts` | `src/game/fx/economy/coin-flight-math.test.ts` |  |
| `src/game/fx/coin-flight-math.ts` | `src/game/fx/economy/coin-flight-math.ts` |  |
| `src/game/fx/coin-fx.ts` | `src/game/fx/economy/coin-fx.ts` |  |
| `src/game/fx/combo-glow.ts` | `src/game/fx/tower/combo-glow.ts` |  |
| `src/game/fx/cream-roll-textures.ts` | `src/game/fx/toppers/cream-roll-textures.ts` |  |
| `src/game/fx/cue-sounds.test.ts` | `src/game/fx/audio/cue-sounds.test.ts` |  |
| `src/game/fx/cue-sounds.ts` | `src/game/fx/audio/cue-sounds.ts` | звуки эффектов (тема audio) |
| `src/game/fx/cut-fx.ts` | `src/game/fx/cuts/cut-fx.ts` |  |
| `src/game/fx/cut-override.ts` | `src/game/fx/cuts/cut-override.ts` |  |
| `src/game/fx/cut-panic.ts` | `src/game/fx/cuts/cut-panic.ts` |  |
| `src/game/fx/cut-strand-geometry.test.ts` | `src/game/fx/cuts/cut-strand-geometry.test.ts` |  |
| `src/game/fx/cut-strand-geometry.ts` | `src/game/fx/cuts/cut-strand-geometry.ts` |  |
| `src/game/fx/cut-strands.ts` | `src/game/fx/cuts/cut-strands.ts` |  |
| `src/game/fx/cut-textures.ts` | `src/game/fx/cuts/cut-textures.ts` |  |
| `src/game/fx/cut-timeline.test.ts` | `src/game/fx/cuts/cut-timeline.test.ts` |  |
| `src/game/fx/cut-timeline.ts` | `src/game/fx/cuts/cut-timeline.ts` |  |
| `src/game/fx/cut-trace-place.test.ts` | `src/game/fx/cuts/cut-trace-place.test.ts` |  |
| `src/game/fx/cut-trace-place.ts` | `src/game/fx/cuts/cut-trace-place.ts` |  |
| `src/game/fx/cut-variant.test.ts` | `src/game/fx/cuts/cut-variant.test.ts` |  |
| `src/game/fx/cut-variant.ts` | `src/game/fx/cuts/cut-variant.ts` |  |
| `src/game/fx/debris-fx.ts` | `src/game/fx/tower/debris-fx.ts` |  |
| `src/game/fx/ease.ts` | `src/game/fx/common/ease.ts` |  |
| `src/game/fx/effect-cues.test.ts` | `src/game/fx/audio/effect-cues.test.ts` |  |
| `src/game/fx/effect-cues.ts` | `src/game/fx/audio/effect-cues.ts` |  |
| `src/game/fx/falling-piece.ts` | `src/game/fx/tower/falling-piece.ts` |  |
| `src/game/fx/float-text.ts` | `src/game/fx/common/float-text.ts` |  |
| `src/game/fx/flying-follow.ts` | `src/game/fx/tower/flying-follow.ts` |  |
| `src/game/fx/flying-fx-depth.ts` | `src/game/fx/tower/flying-fx-depth.ts` |  |
| `src/game/fx/flying-fx.ts` | `src/game/fx/tower/flying-fx.ts` |  |
| `src/game/fx/frame-work-stats.test.ts` | `src/game/fx/app/frame-work-stats.test.ts` |  |
| `src/game/fx/frame-work-stats.ts` | `src/game/fx/app/frame-work-stats.ts` | работа кадра для уровня эффектов (тема app) |
| `src/game/fx/frame-work-watch.test.ts` | `src/game/fx/app/frame-work-watch.test.ts` |  |
| `src/game/fx/frame-work-watch.ts` | `src/game/fx/app/frame-work-watch.ts` |  |
| `src/game/fx/fx-textures.ts` | `src/game/fx/common/fx-textures.ts` |  |
| `src/game/fx/gift-texture.ts` | `src/game/fx/economy/gift-texture.ts` |  |
| `src/game/fx/glaze-drip.ts` | `src/game/fx/glaze/glaze-drip.ts` |  |
| `src/game/fx/glaze-drop-fall.ts` | `src/game/fx/glaze/glaze-drop-fall.ts` |  |
| `src/game/fx/glaze-growth.test.ts` | `src/game/fx/glaze/glaze-growth.test.ts` |  |
| `src/game/fx/glaze-growth.ts` | `src/game/fx/glaze/glaze-growth.ts` |  |
| `src/game/fx/gloss-sweep.ts` | `src/game/fx/common/gloss-sweep.ts` |  |
| `src/game/fx/golden-fx.ts` | `src/game/fx/economy/golden-fx.ts` |  |
| `src/game/fx/grown-accent-textures.ts` | `src/game/fx/creatures/grown-accent-textures.ts` |  |
| `src/game/fx/idle-bob.ts` | `src/game/fx/common/idle-bob.ts` |  |
| `src/game/fx/landing-fx.ts` | `src/game/fx/tower/landing-fx.ts` |  |
| `src/game/fx/lap-edge-math.test.ts` | `src/game/fx/zones/lap-edge-math.test.ts` |  |
| `src/game/fx/lap-edge-math.ts` | `src/game/fx/zones/lap-edge-math.ts` |  |
| `src/game/fx/lap-edges.ts` | `src/game/fx/zones/lap-edges.ts` |  |
| `src/game/fx/layer-sparkle.test.ts` | `src/game/fx/tower/layer-sparkle.test.ts` |  |
| `src/game/fx/layer-sparkle.ts` | `src/game/fx/tower/layer-sparkle.ts` |  |
| `src/game/fx/material-fx.test.ts` | `src/game/fx/creatures/material-fx.test.ts` |  |
| `src/game/fx/material-fx.ts` | `src/game/fx/creatures/material-fx.ts` | частицы материала существа |
| `src/game/fx/moment-cues.test.ts` | `src/game/fx/audio/moment-cues.test.ts` |  |
| `src/game/fx/moment-cues.ts` | `src/game/fx/audio/moment-cues.ts` |  |
| `src/game/fx/nebula-arms.test.ts` | `src/game/fx/zones/nebula-arms.test.ts` |  |
| `src/game/fx/nebula-arms.ts` | `src/game/fx/zones/nebula-arms.ts` |  |
| `src/game/fx/offline-icon-texture.ts` | `src/game/fx/economy/offline-icon-texture.ts` |  |
| `src/game/fx/oven-texture.ts` | `src/game/fx/economy/oven-texture.ts` |  |
| `src/game/fx/particle-fx.ts` | `src/game/fx/common/particle-fx.ts` |  |
| `src/game/fx/particle-motion.test.ts` | `src/game/fx/common/particle-motion.test.ts` |  |
| `src/game/fx/particle-motion.ts` | `src/game/fx/common/particle-motion.ts` |  |
| `src/game/fx/particles.ts` | `src/game/fx/common/particles.ts` |  |
| `src/game/fx/payout.test.ts` | `src/game/fx/economy/payout.test.ts` |  |
| `src/game/fx/payout.ts` | `src/game/fx/economy/payout.ts` |  |
| `src/game/fx/pennant-side.test.ts` | `src/game/fx/run/pennant-side.test.ts` |  |
| `src/game/fx/pennant-side.ts` | `src/game/fx/run/pennant-side.ts` | флажок рекорда; импортирует только record-moment |
| `src/game/fx/perfect-ring.ts` | `src/game/fx/tower/perfect-ring.ts` |  |
| `src/game/fx/pile-size.test.ts` | `src/game/fx/economy/pile-size.test.ts` |  |
| `src/game/fx/pile-size.ts` | `src/game/fx/economy/pile-size.ts` |  |
| `src/game/fx/plain-style.test.ts` | `src/game/fx/common/plain-style.test.ts` |  |
| `src/game/fx/plain-style.ts` | `src/game/fx/common/plain-style.ts` |  |
| `src/game/fx/record-celebration.ts` | `src/game/fx/run/record-celebration.ts` |  |
| `src/game/fx/record-moment.ts` | `src/game/fx/run/record-moment.ts` |  |
| `src/game/fx/results-prep.ts` | `src/game/fx/run/results-prep.ts` |  |
| `src/game/fx/reward-pictures.ts` | `src/game/fx/economy/reward-pictures.ts` |  |
| `src/game/fx/rule-fx.ts` | `src/game/fx/zones/rule-fx.ts` |  |
| `src/game/fx/rule-state.test.ts` | `src/game/fx/zones/rule-state.test.ts` |  |
| `src/game/fx/rule-state.ts` | `src/game/fx/zones/rule-state.ts` |  |
| `src/game/fx/run-cues.test.ts` | `src/game/fx/audio/run-cues.test.ts` |  |
| `src/game/fx/run-cues.ts` | `src/game/fx/audio/run-cues.ts` |  |
| `src/game/fx/run-fx.ts` | `src/game/fx/run/run-fx.ts` |  |
| `src/game/fx/run-intro.test.ts` | `src/game/fx/run/run-intro.test.ts` |  |
| `src/game/fx/run-intro.ts` | `src/game/fx/run/run-intro.ts` |  |
| `src/game/fx/rush-outline.ts` | `src/game/fx/zones/rush-outline.ts` |  |
| `src/game/fx/rush-windup.test.ts` | `src/game/fx/zones/rush-windup.test.ts` |  |
| `src/game/fx/rush-windup.ts` | `src/game/fx/zones/rush-windup.ts` |  |
| `src/game/fx/shadow-emphasis.test.ts` | `src/game/fx/tower/shadow-emphasis.test.ts` |  |
| `src/game/fx/shadow-emphasis.ts` | `src/game/fx/tower/shadow-emphasis.ts` | тень летящего слоя |
| `src/game/fx/sparkle-fx.ts` | `src/game/fx/common/sparkle-fx.ts` |  |
| `src/game/fx/speed-streaks.ts` | `src/game/fx/zones/speed-streaks.ts` |  |
| `src/game/fx/spring-back.ts` | `src/game/fx/common/spring-back.ts` |  |
| `src/game/fx/squash-textures.ts` | `src/game/fx/toppers/squash-textures.ts` |  |
| `src/game/fx/streak-math.test.ts` | `src/game/fx/zones/streak-math.test.ts` |  |
| `src/game/fx/streak-math.ts` | `src/game/fx/zones/streak-math.ts` |  |
| `src/game/fx/timed-pool.test.ts` | `src/game/fx/common/timed-pool.test.ts` |  |
| `src/game/fx/timed-pool.ts` | `src/game/fx/common/timed-pool.ts` |  |
| `src/game/fx/topper-fx.ts` | `src/game/fx/toppers/topper-fx.ts` |  |
| `src/game/fx/topper-squash-fx.ts` | `src/game/fx/toppers/topper-squash-fx.ts` |  |
| `src/game/fx/topper-squash-plan.test.ts` | `src/game/fx/toppers/topper-squash-plan.test.ts` |  |
| `src/game/fx/topper-squash-plan.ts` | `src/game/fx/toppers/topper-squash-plan.ts` |  |
| `src/game/fx/topper-texture.ts` | `src/game/fx/toppers/topper-texture.ts` |  |
| `src/game/fx/tower-collapse.ts` | `src/game/fx/tower/tower-collapse.ts` |  |
| `src/game/fx/tower-sparkle-spot.test.ts` | `src/game/fx/tower/tower-sparkle-spot.test.ts` |  |
| `src/game/fx/tower-sparkle-spot.ts` | `src/game/fx/tower/tower-sparkle-spot.ts` |  |
| `src/game/fx/tower-sparkles.ts` | `src/game/fx/tower/tower-sparkles.ts` |  |
| `src/game/fx/treasure-pile.ts` | `src/game/fx/economy/treasure-pile.ts` |  |
| `src/game/fx/treasure-textures.ts` | `src/game/fx/economy/treasure-textures.ts` |  |
| `src/game/fx/tutorial-target.ts` | `src/game/fx/run/tutorial-target.ts` | сцена забега сообщает обучению, где что стоит; остаётся в fx |
| `src/game/fx/video-icon-texture.ts` | `src/game/fx/economy/video-icon-texture.ts` |  |

## src/game/objects (141)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/game/objects/collapse-prep.ts` | `src/game/objects/tower/collapse-prep.ts` |  |
| `src/game/objects/collapse-scan.test.ts` | `src/game/objects/tower/collapse-scan.test.ts` |  |
| `src/game/objects/collapse-scan.ts` | `src/game/objects/tower/collapse-scan.ts` |  |
| `src/game/objects/continue-driver.ts` | `src/game/objects/run/continue-driver.ts` |  |
| `src/game/objects/creature-art/baked.ts` | `src/game/objects/creatures/creature-art/baked.ts` |  |
| `src/game/objects/creature-art/creamy.ts` | `src/game/objects/creatures/creature-art/creamy.ts` |  |
| `src/game/objects/creature-art/flat-draw.test.ts` | `src/game/objects/creatures/creature-art/flat-draw.test.ts` |  |
| `src/game/objects/creature-art/flat-draw.ts` | `src/game/objects/creatures/creature-art/flat-draw.ts` |  |
| `src/game/objects/creature-art/grown-anchors.ts` | `src/game/objects/creatures/creature-art/grown-anchors.ts` |  |
| `src/game/objects/creature-art/grown.ts` | `src/game/objects/creatures/creature-art/grown.ts` |  |
| `src/game/objects/creature-art/index.ts` | `src/game/objects/creatures/creature-art/index.ts` |  |
| `src/game/objects/creature-art/layered.ts` | `src/game/objects/creatures/creature-art/layered.ts` |  |
| `src/game/objects/creature-art/primitives.ts` | `src/game/objects/creatures/creature-art/primitives.ts` |  |
| `src/game/objects/creature-art/rainbow-geometry.test.ts` | `src/game/objects/creatures/creature-art/rainbow-geometry.test.ts` |  |
| `src/game/objects/creature-art/rainbow-geometry.ts` | `src/game/objects/creatures/creature-art/rainbow-geometry.ts` |  |
| `src/game/objects/creature-art/rainbow-idle-geometry.test.ts` | `src/game/objects/creatures/creature-art/rainbow-idle-geometry.test.ts` |  |
| `src/game/objects/creature-art/rainbow-idle-geometry.ts` | `src/game/objects/creatures/creature-art/rainbow-idle-geometry.ts` |  |
| `src/game/objects/creature-art/rainbow.ts` | `src/game/objects/creatures/creature-art/rainbow.ts` |  |
| `src/game/objects/creature-art/sleep-look.test.ts` | `src/game/objects/creatures/creature-art/sleep-look.test.ts` |  |
| `src/game/objects/creature-art/sleep-look.ts` | `src/game/objects/creatures/creature-art/sleep-look.ts` |  |
| `src/game/objects/creature-art/twins-seam.test.ts` | `src/game/objects/creatures/creature-art/twins-seam.test.ts` |  |
| `src/game/objects/creature-art/twins-seam.ts` | `src/game/objects/creatures/creature-art/twins-seam.ts` |  |
| `src/game/objects/creature-icon-fit.test.ts` | `src/game/objects/creatures/creature-icon-fit.test.ts` |  |
| `src/game/objects/creature-icon-fit.ts` | `src/game/objects/creatures/creature-icon-fit.ts` |  |
| `src/game/objects/creature-icon-textures.ts` | `src/game/objects/creatures/creature-icon-textures.ts` |  |
| `src/game/objects/creature-portrait.ts` | `src/game/objects/creatures/creature-portrait.ts` |  |
| `src/game/objects/decor-draw.ts` | `src/game/objects/tower/decor-draw.ts` |  |
| `src/game/objects/decor-layout.test.ts` | `src/game/objects/tower/decor-layout.test.ts` |  |
| `src/game/objects/decor-layout.ts` | `src/game/objects/tower/decor-layout.ts` |  |
| `src/game/objects/drift-geometry.test.ts` | `src/game/objects/weather/drift-geometry.test.ts` |  |
| `src/game/objects/drift-geometry.ts` | `src/game/objects/weather/drift-geometry.ts` | сугробы на выступах; читает и backdrop/weather |
| `src/game/objects/edge-squash-columns.ts` | `src/game/objects/tower/edge-squash/edge-squash-columns.ts` |  |
| `src/game/objects/edge-squash-look.test.ts` | `src/game/objects/tower/edge-squash/edge-squash-look.test.ts` |  |
| `src/game/objects/edge-squash-look.ts` | `src/game/objects/tower/edge-squash/edge-squash-look.ts` |  |
| `src/game/objects/edge-squash-marks.ts` | `src/game/objects/tower/edge-squash/edge-squash-marks.ts` |  |
| `src/game/objects/edge-squash-ribs.test.ts` | `src/game/objects/tower/edge-squash/edge-squash-ribs.test.ts` |  |
| `src/game/objects/edge-squash-ribs.ts` | `src/game/objects/tower/edge-squash/edge-squash-ribs.ts` |  |
| `src/game/objects/edge-squash-silhouette.ts` | `src/game/objects/tower/edge-squash/edge-squash-silhouette.ts` |  |
| `src/game/objects/edge-squash-skin.ts` | `src/game/objects/tower/edge-squash/edge-squash-skin.ts` |  |
| `src/game/objects/edge-squash.test.ts` | `src/game/objects/tower/edge-squash/edge-squash.test.ts` |  |
| `src/game/objects/edge-squash.ts` | `src/game/objects/tower/edge-squash/edge-squash.ts` | придавливание края — 8 модулей и 3 теста; tower без них больше 40 файлов, поэтому своя подпапка внутри tower |
| `src/game/objects/face-lick.ts` | `src/game/objects/glaze/face-lick.ts` |  |
| `src/game/objects/face-parts.ts` | `src/game/objects/creatures/face-parts.ts` |  |
| `src/game/objects/face-recipe.test.ts` | `src/game/objects/creatures/face-recipe.test.ts` |  |
| `src/game/objects/face-recipe.ts` | `src/game/objects/creatures/face-recipe.ts` |  |
| `src/game/objects/face-state.test.ts` | `src/game/objects/creatures/face-state.test.ts` |  |
| `src/game/objects/face-state.ts` | `src/game/objects/creatures/face-state.ts` |  |
| `src/game/objects/face-textures.ts` | `src/game/objects/creatures/face-textures.ts` |  |
| `src/game/objects/face-yawn.test.ts` | `src/game/objects/creatures/face-yawn.test.ts` |  |
| `src/game/objects/face-yawn.ts` | `src/game/objects/creatures/face-yawn.ts` |  |
| `src/game/objects/floating-coin.ts` | `src/game/objects/economy/floating-coin.ts` |  |
| `src/game/objects/flying-edge-squash.test.ts` | `src/game/objects/tower/edge-squash/flying-edge-squash.test.ts` |  |
| `src/game/objects/flying-edge-squash.ts` | `src/game/objects/tower/edge-squash/flying-edge-squash.ts` |  |
| `src/game/objects/flying-layer-view.ts` | `src/game/objects/tower/flying-layer-view.ts` |  |
| `src/game/objects/glaze-drip-growth.ts` | `src/game/objects/glaze/glaze-drip-growth.ts` |  |
| `src/game/objects/glaze-drip-layer.ts` | `src/game/objects/glaze/glaze-drip-layer.ts` |  |
| `src/game/objects/glaze-drip-textures.ts` | `src/game/objects/glaze/glaze-drip-textures.ts` |  |
| `src/game/objects/glaze-pattern.test.ts` | `src/game/objects/glaze/glaze-pattern.test.ts` |  |
| `src/game/objects/glaze-pattern.ts` | `src/game/objects/glaze/glaze-pattern.ts` |  |
| `src/game/objects/glaze-wave.test.ts` | `src/game/objects/glaze/glaze-wave.test.ts` |  |
| `src/game/objects/glaze-wave.ts` | `src/game/objects/glaze/glaze-wave.ts` |  |
| `src/game/objects/grown-accent-view.ts` | `src/game/objects/creatures/grown-accent-view.ts` |  |
| `src/game/objects/juice-lick-plan.test.ts` | `src/game/objects/glaze/juice-lick-plan.test.ts` |  |
| `src/game/objects/juice-lick-plan.ts` | `src/game/objects/glaze/juice-lick-plan.ts` |  |
| `src/game/objects/landing-prep.ts` | `src/game/objects/tower/landing-prep.ts` |  |
| `src/game/objects/layer-art-slot.ts` | `src/game/objects/tower/layer-art-slot.ts` |  |
| `src/game/objects/layer-art.test.ts` | `src/game/objects/tower/layer-art.test.ts` |  |
| `src/game/objects/layer-art.ts` | `src/game/objects/tower/layer-art.ts` |  |
| `src/game/objects/layer-draw.ts` | `src/game/objects/tower/layer-draw.ts` |  |
| `src/game/objects/layer-drifts.ts` | `src/game/objects/weather/layer-drifts.ts` | сугробы на выступах (погода на башне) |
| `src/game/objects/layer-face.ts` | `src/game/objects/creatures/layer-face.ts` |  |
| `src/game/objects/layer-mark-store.test.ts` | `src/game/objects/tower/layer-mark-store.test.ts` |  |
| `src/game/objects/layer-mark-store.ts` | `src/game/objects/tower/layer-mark-store.ts` |  |
| `src/game/objects/layer-marks.ts` | `src/game/objects/tower/layer-marks.ts` |  |
| `src/game/objects/layer-material.test.ts` | `src/game/objects/creatures/layer-material.test.ts` |  |
| `src/game/objects/layer-material.ts` | `src/game/objects/creatures/layer-material.ts` |  |
| `src/game/objects/layer-press.test.ts` | `src/game/objects/tower/layer-press.test.ts` |  |
| `src/game/objects/layer-press.ts` | `src/game/objects/tower/layer-press.ts` |  |
| `src/game/objects/layer-rig.ts` | `src/game/objects/tower/layer-rig.ts` |  |
| `src/game/objects/layer-shade.ts` | `src/game/objects/tower/layer-shade.ts` |  |
| `src/game/objects/layer-topper.ts` | `src/game/objects/toppers/layer-topper.ts` |  |
| `src/game/objects/layer-view.ts` | `src/game/objects/tower/layer-view.ts` |  |
| `src/game/objects/lick-director.test.ts` | `src/game/objects/glaze/lick-director.test.ts` |  |
| `src/game/objects/lick-director.ts` | `src/game/objects/glaze/lick-director.ts` |  |
| `src/game/objects/lick-plan.test.ts` | `src/game/objects/glaze/lick-plan.test.ts` |  |
| `src/game/objects/lick-plan.ts` | `src/game/objects/glaze/lick-plan.ts` |  |
| `src/game/objects/mastery-look.test.ts` | `src/game/objects/tower/mastery-look.test.ts` | проверяет layer-art |
| `src/game/objects/material-shape.test.ts` | `src/game/objects/creatures/material-shape.test.ts` |  |
| `src/game/objects/material-shape.ts` | `src/game/objects/creatures/material-shape.ts` |  |
| `src/game/objects/overlap-shade.test.ts` | `src/game/objects/tower/overlap-shade.test.ts` |  |
| `src/game/objects/overlap-shade.ts` | `src/game/objects/tower/overlap-shade.ts` |  |
| `src/game/objects/plain-layer-draw.ts` | `src/game/objects/tower/plain-layer-draw.ts` |  |
| `src/game/objects/plain-lines.ts` | `src/game/objects/tower/plain-lines.ts` |  |
| `src/game/objects/plain-look.test.ts` | `src/game/objects/tower/plain-look.test.ts` |  |
| `src/game/objects/plain-look.ts` | `src/game/objects/tower/plain-look.ts` |  |
| `src/game/objects/portrait-sparkles.ts` | `src/game/objects/creatures/portrait-sparkles.ts` |  |
| `src/game/objects/rainbow-idle.ts` | `src/game/objects/creatures/rainbow-idle.ts` |  |
| `src/game/objects/sleep-eyes.test.ts` | `src/game/objects/creatures/sleep-eyes.test.ts` |  |
| `src/game/objects/sleep-eyes.ts` | `src/game/objects/creatures/sleep-eyes.ts` |  |
| `src/game/objects/sleep-letters.ts` | `src/game/objects/creatures/sleep-letters.ts` |  |
| `src/game/objects/sleep-silhouette.ts` | `src/game/objects/creatures/sleep-silhouette.ts` |  |
| `src/game/objects/sleep-zs.test.ts` | `src/game/objects/creatures/sleep-zs.test.ts` |  |
| `src/game/objects/sleep-zs.ts` | `src/game/objects/creatures/sleep-zs.ts` |  |
| `src/game/objects/sponge-material.test.ts` | `src/game/objects/creatures/sponge-material.test.ts` |  |
| `src/game/objects/sponge-material.ts` | `src/game/objects/creatures/sponge-material.ts` | материал существа |
| `src/game/objects/sponge-pores.ts` | `src/game/objects/creatures/sponge-pores.ts` |  |
| `src/game/objects/strip-rope.ts` | `src/game/objects/glaze/strip-rope.ts` | верёвка языка; ей пользуются и нити срезов |
| `src/game/objects/svg-textures.ts` | `src/game/objects/common/svg-textures.ts` |  |
| `src/game/objects/sway-hold.test.ts` | `src/game/objects/tower/sway-hold.test.ts` |  |
| `src/game/objects/sway-hold.ts` | `src/game/objects/tower/sway-hold.ts` |  |
| `src/game/objects/tongue-draw.ts` | `src/game/objects/glaze/tongue-draw.ts` |  |
| `src/game/objects/tongue-graphics.ts` | `src/game/objects/glaze/tongue-graphics.ts` |  |
| `src/game/objects/tongue-ribbon.test.ts` | `src/game/objects/glaze/tongue-ribbon.test.ts` |  |
| `src/game/objects/tongue-ribbon.ts` | `src/game/objects/glaze/tongue-ribbon.ts` |  |
| `src/game/objects/tongue-shape.test.ts` | `src/game/objects/glaze/tongue-shape.test.ts` |  |
| `src/game/objects/tongue-shape.ts` | `src/game/objects/glaze/tongue-shape.ts` |  |
| `src/game/objects/tongue-strip-geometry.test.ts` | `src/game/objects/glaze/tongue-strip-geometry.test.ts` |  |
| `src/game/objects/tongue-strip-geometry.ts` | `src/game/objects/glaze/tongue-strip-geometry.ts` |  |
| `src/game/objects/tongue-strip-texture.ts` | `src/game/objects/glaze/tongue-strip-texture.ts` |  |
| `src/game/objects/tongue-strip.ts` | `src/game/objects/glaze/tongue-strip.ts` |  |
| `src/game/objects/tongue-view.ts` | `src/game/objects/glaze/tongue-view.ts` |  |
| `src/game/objects/topper-look.test.ts` | `src/game/objects/toppers/topper-look.test.ts` |  |
| `src/game/objects/topper-look.ts` | `src/game/objects/toppers/topper-look.ts` |  |
| `src/game/objects/tower-guest-art.ts` | `src/game/objects/guests/tower-guest-art.ts` |  |
| `src/game/objects/tower-guest-flight.ts` | `src/game/objects/guests/tower-guest-flight.ts` |  |
| `src/game/objects/tower-guest-picture.ts` | `src/game/objects/guests/tower-guest-picture.ts` |  |
| `src/game/objects/tower-guest-plan.test.ts` | `src/game/objects/guests/tower-guest-plan.test.ts` |  |
| `src/game/objects/tower-guest-plan.ts` | `src/game/objects/guests/tower-guest-plan.ts` |  |
| `src/game/objects/tower-guest-shape.ts` | `src/game/objects/guests/tower-guest-shape.ts` |  |
| `src/game/objects/tower-guest-shy.ts` | `src/game/objects/guests/tower-guest-shy.ts` |  |
| `src/game/objects/tower-guest-site.ts` | `src/game/objects/guests/tower-guest-site.ts` |  |
| `src/game/objects/tower-guest-splat.ts` | `src/game/objects/guests/tower-guest-splat.ts` |  |
| `src/game/objects/tower-guest-types.ts` | `src/game/objects/guests/tower-guest-types.ts` |  |
| `src/game/objects/tower-guest-visit.ts` | `src/game/objects/guests/tower-guest-visit.ts` |  |
| `src/game/objects/tower-guest.ts` | `src/game/objects/guests/tower-guest.ts` |  |
| `src/game/objects/tower-snapshot.ts` | `src/game/objects/tower/tower-snapshot.ts` |  |
| `src/game/objects/tower-view.ts` | `src/game/objects/tower/tower-view.ts` |  |
| `src/game/objects/tower-weather-fx.test.ts` | `src/game/objects/weather/tower-weather-fx.test.ts` |  |
| `src/game/objects/tower-weather-fx.ts` | `src/game/objects/weather/tower-weather-fx.ts` |  |
| `src/game/objects/tower-weather-state.ts` | `src/game/objects/weather/tower-weather-state.ts` |  |
| `src/game/objects/tray.ts` | `src/game/objects/tower/tray.ts` |  |

## src/game/objects/backdrop (78)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/game/objects/backdrop/art-kit.ts` | `src/game/objects/backdrop/common/art-kit.ts` | доски стен; берут несколько зон и fx |
| `src/game/objects/backdrop/backdrop.ts` | `src/game/objects/backdrop/common/backdrop.ts` |  |
| `src/game/objects/backdrop/blob-pixels.test.ts` | `src/game/objects/backdrop/space/blob-pixels.test.ts` |  |
| `src/game/objects/backdrop/blob-pixels.ts` | `src/game/objects/backdrop/space/blob-pixels.ts` |  |
| `src/game/objects/backdrop/clouds-zone.ts` | `src/game/objects/backdrop/zones/clouds-zone.ts` |  |
| `src/game/objects/backdrop/dessert-planets.ts` | `src/game/objects/backdrop/space/dessert-planets.ts` |  |
| `src/game/objects/backdrop/far-plane.ts` | `src/game/objects/backdrop/zones/far-plane.ts` |  |
| `src/game/objects/backdrop/glass-motion.test.ts` | `src/game/objects/backdrop/panorama/glass-motion.test.ts` |  |
| `src/game/objects/backdrop/glass-motion.ts` | `src/game/objects/backdrop/panorama/glass-motion.ts` |  |
| `src/game/objects/backdrop/guest-source.ts` | `src/game/objects/backdrop/life/guest-source.ts` | место существа фона для его жизни |
| `src/game/objects/backdrop/kitchen-zone.ts` | `src/game/objects/backdrop/zones/kitchen-zone.ts` |  |
| `src/game/objects/backdrop/layer-anchor.test.ts` | `src/game/objects/backdrop/life/layer-anchor.test.ts` |  |
| `src/game/objects/backdrop/layer-anchor.ts` | `src/game/objects/backdrop/life/layer-anchor.ts` |  |
| `src/game/objects/backdrop/layer-life.ts` | `src/game/objects/backdrop/life/layer-life.ts` |  |
| `src/game/objects/backdrop/life-motion.test.ts` | `src/game/objects/backdrop/life/life-motion.test.ts` |  |
| `src/game/objects/backdrop/life-motion.ts` | `src/game/objects/backdrop/life/life-motion.ts` |  |
| `src/game/objects/backdrop/life.ts` | `src/game/objects/backdrop/life/life.ts` |  |
| `src/game/objects/backdrop/lightning-flash.ts` | `src/game/objects/backdrop/weather/lightning-flash.ts` | вспышка грозы; читает и objects/tower |
| `src/game/objects/backdrop/mountain-placement.test.ts` | `src/game/objects/backdrop/zones/mountain-placement.test.ts` |  |
| `src/game/objects/backdrop/mountain-placement.ts` | `src/game/objects/backdrop/zones/mountain-placement.ts` |  |
| `src/game/objects/backdrop/mountains.ts` | `src/game/objects/backdrop/zones/mountains.ts` |  |
| `src/game/objects/backdrop/panorama-art.ts` | `src/game/objects/backdrop/panorama/panorama-art.ts` |  |
| `src/game/objects/backdrop/panorama-fit.test.ts` | `src/game/objects/backdrop/panorama/panorama-fit.test.ts` |  |
| `src/game/objects/backdrop/panorama-fit.ts` | `src/game/objects/backdrop/panorama/panorama-fit.ts` |  |
| `src/game/objects/backdrop/panorama-flash.ts` | `src/game/objects/backdrop/panorama/panorama-flash.ts` |  |
| `src/game/objects/backdrop/panorama-moon.ts` | `src/game/objects/backdrop/panorama/panorama-moon.ts` |  |
| `src/game/objects/backdrop/panorama-window.ts` | `src/game/objects/backdrop/panorama/panorama-window.ts` |  |
| `src/game/objects/backdrop/pass-timer.test.ts` | `src/game/objects/backdrop/life/pass-timer.test.ts` |  |
| `src/game/objects/backdrop/pass-timer.ts` | `src/game/objects/backdrop/life/pass-timer.ts` |  |
| `src/game/objects/backdrop/planet-life.ts` | `src/game/objects/backdrop/space/planet-life.ts` |  |
| `src/game/objects/backdrop/planet-placement.test.ts` | `src/game/objects/backdrop/space/planet-placement.test.ts` |  |
| `src/game/objects/backdrop/planet-placement.ts` | `src/game/objects/backdrop/space/planet-placement.ts` |  |
| `src/game/objects/backdrop/roof-zone.ts` | `src/game/objects/backdrop/zones/roof-zone.ts` |  |
| `src/game/objects/backdrop/run-weather.ts` | `src/game/objects/backdrop/weather/run-weather.ts` |  |
| `src/game/objects/backdrop/shop-display.ts` | `src/game/objects/backdrop/zones/shop-display.ts` |  |
| `src/game/objects/backdrop/shop-hang.test.ts` | `src/game/objects/backdrop/zones/shop-hang.test.ts` |  |
| `src/game/objects/backdrop/shop-hang.ts` | `src/game/objects/backdrop/zones/shop-hang.ts` |  |
| `src/game/objects/backdrop/shop-zone.ts` | `src/game/objects/backdrop/zones/shop-zone.ts` |  |
| `src/game/objects/backdrop/showcase-zone.ts` | `src/game/objects/backdrop/zones/showcase-zone.ts` |  |
| `src/game/objects/backdrop/sky-gradient.test.ts` | `src/game/objects/backdrop/common/sky-gradient.test.ts` |  |
| `src/game/objects/backdrop/sky-gradient.ts` | `src/game/objects/backdrop/common/sky-gradient.ts` | небо; берут несколько зон и fx |
| `src/game/objects/backdrop/snow-dust-motion.test.ts` | `src/game/objects/backdrop/weather/snow-dust-motion.test.ts` |  |
| `src/game/objects/backdrop/snow-dust-motion.ts` | `src/game/objects/backdrop/weather/snow-dust-motion.ts` |  |
| `src/game/objects/backdrop/snow-dust.ts` | `src/game/objects/backdrop/weather/snow-dust.ts` |  |
| `src/game/objects/backdrop/space-visitor-art.ts` | `src/game/objects/backdrop/space/space-visitor-art.ts` |  |
| `src/game/objects/backdrop/space-visitor-plan.test.ts` | `src/game/objects/backdrop/space/space-visitor-plan.test.ts` |  |
| `src/game/objects/backdrop/space-visitor-plan.ts` | `src/game/objects/backdrop/space/space-visitor-plan.ts` |  |
| `src/game/objects/backdrop/space-visitor.ts` | `src/game/objects/backdrop/space/space-visitor.ts` |  |
| `src/game/objects/backdrop/space-zone.ts` | `src/game/objects/backdrop/space/space-zone.ts` |  |
| `src/game/objects/backdrop/stars-zone.ts` | `src/game/objects/backdrop/zones/stars-zone.ts` |  |
| `src/game/objects/backdrop/street-weather.test.ts` | `src/game/objects/backdrop/weather/street-weather.test.ts` |  |
| `src/game/objects/backdrop/street-weather.ts` | `src/game/objects/backdrop/weather/street-weather.ts` |  |
| `src/game/objects/backdrop/weather-art.ts` | `src/game/objects/backdrop/weather/weather-art.ts` |  |
| `src/game/objects/backdrop/weather-fall.ts` | `src/game/objects/backdrop/weather/weather-fall.ts` |  |
| `src/game/objects/backdrop/weather-frame.ts` | `src/game/objects/backdrop/weather/weather-frame.ts` |  |
| `src/game/objects/backdrop/weather-lanes.test.ts` | `src/game/objects/backdrop/weather/weather-lanes.test.ts` |  |
| `src/game/objects/backdrop/weather-lanes.ts` | `src/game/objects/backdrop/weather/weather-lanes.ts` |  |
| `src/game/objects/backdrop/weather-motion.test.ts` | `src/game/objects/backdrop/weather/weather-motion.test.ts` |  |
| `src/game/objects/backdrop/weather-motion.ts` | `src/game/objects/backdrop/weather/weather-motion.ts` |  |
| `src/game/objects/backdrop/weather-palette.ts` | `src/game/objects/backdrop/weather/weather-palette.ts` |  |
| `src/game/objects/backdrop/weather-share.test.ts` | `src/game/objects/backdrop/weather/weather-share.test.ts` |  |
| `src/game/objects/backdrop/weather-share.ts` | `src/game/objects/backdrop/weather/weather-share.ts` |  |
| `src/game/objects/backdrop/weather-sky.ts` | `src/game/objects/backdrop/weather/weather-sky.ts` |  |
| `src/game/objects/backdrop/weather-strike.test.ts` | `src/game/objects/backdrop/weather/weather-strike.test.ts` | проверяет weather-art |
| `src/game/objects/backdrop/weather-test-view.ts` | `src/game/objects/backdrop/weather/weather-test-view.ts` |  |
| `src/game/objects/backdrop/weather-top.ts` | `src/game/objects/backdrop/weather/weather-top.ts` |  |
| `src/game/objects/backdrop/window-paint.test.ts` | `src/game/objects/backdrop/panorama/window-paint.test.ts` |  |
| `src/game/objects/backdrop/window-paint.ts` | `src/game/objects/backdrop/panorama/window-paint.ts` |  |
| `src/game/objects/backdrop/window-weather.ts` | `src/game/objects/backdrop/weather/window-weather.ts` |  |
| `src/game/objects/backdrop/worktop.ts` | `src/game/objects/backdrop/zones/worktop.ts` |  |
| `src/game/objects/backdrop/zone-anchors.test.ts` | `src/game/objects/backdrop/zones/zone-anchors.test.ts` | проверяет зоны и zone-scenery |
| `src/game/objects/backdrop/zone-fade.test.ts` | `src/game/objects/backdrop/zones/zone-fade.test.ts` |  |
| `src/game/objects/backdrop/zone-fade.ts` | `src/game/objects/backdrop/zones/zone-fade.ts` |  |
| `src/game/objects/backdrop/zone-mix.test.ts` | `src/game/objects/backdrop/zones/zone-mix.test.ts` |  |
| `src/game/objects/backdrop/zone-mix.ts` | `src/game/objects/backdrop/zones/zone-mix.ts` |  |
| `src/game/objects/backdrop/zone-prep.test.ts` | `src/game/objects/backdrop/zones/zone-prep.test.ts` |  |
| `src/game/objects/backdrop/zone-prep.ts` | `src/game/objects/backdrop/zones/zone-prep.ts` |  |
| `src/game/objects/backdrop/zone-scenery.ts` | `src/game/objects/backdrop/zones/zone-scenery.ts` |  |

## src/game/ui (56)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/game/ui/bake-texture.test.ts` | `src/game/ui/common/bake-texture.test.ts` |  |
| `src/game/ui/bake-texture.ts` | `src/game/ui/common/bake-texture.ts` |  |
| `src/game/ui/button.ts` | `src/game/ui/common/button.ts` |  |
| `src/game/ui/continue-berry-flight.ts` | `src/game/ui/run/continue-berry-flight.ts` |  |
| `src/game/ui/continue-buttons.ts` | `src/game/ui/run/continue-buttons.ts` |  |
| `src/game/ui/continue-timer.test.ts` | `src/game/ui/run/continue-timer.test.ts` |  |
| `src/game/ui/continue-timer.ts` | `src/game/ui/run/continue-timer.ts` |  |
| `src/game/ui/continue-window.ts` | `src/game/ui/run/continue-window.ts` |  |
| `src/game/ui/cpu-canvas.test.ts` | `src/game/ui/common/cpu-canvas.test.ts` |  |
| `src/game/ui/cpu-canvas.ts` | `src/game/ui/common/cpu-canvas.ts` |  |
| `src/game/ui/creature-icons.test.ts` | `src/game/ui/creatures/creature-icons.test.ts` |  |
| `src/game/ui/creature-icons.ts` | `src/game/ui/creatures/creature-icons.ts` |  |
| `src/game/ui/dim-overlay.ts` | `src/game/ui/common/dim-overlay.ts` |  |
| `src/game/ui/effect-badge-state.test.ts` | `src/game/ui/creatures/effect-badge-state.test.ts` |  |
| `src/game/ui/effect-badge-state.ts` | `src/game/ui/creatures/effect-badge-state.ts` |  |
| `src/game/ui/effect-badges.ts` | `src/game/ui/creatures/effect-badges.ts` | значки способностей существ в HUD |
| `src/game/ui/font-refresh.ts` | `src/game/ui/common/font-refresh.ts` |  |
| `src/game/ui/fonts.ts` | `src/game/ui/common/fonts.ts` |  |
| `src/game/ui/hud-idle.ts` | `src/game/ui/run/hud-idle.ts` |  |
| `src/game/ui/hud-row-layout.test.ts` | `src/game/ui/run/hud-row-layout.test.ts` |  |
| `src/game/ui/hud-row-layout.ts` | `src/game/ui/run/hud-row-layout.ts` |  |
| `src/game/ui/idle-motion.test.ts` | `src/game/ui/common/idle-motion.test.ts` |  |
| `src/game/ui/idle-motion.ts` | `src/game/ui/common/idle-motion.ts` |  |
| `src/game/ui/master-caption-art.ts` | `src/game/ui/creatures/master-caption-art.ts` |  |
| `src/game/ui/master-caption-state.test.ts` | `src/game/ui/creatures/master-caption-state.test.ts` |  |
| `src/game/ui/master-caption-state.ts` | `src/game/ui/creatures/master-caption-state.ts` |  |
| `src/game/ui/master-captions.ts` | `src/game/ui/creatures/master-captions.ts` |  |
| `src/game/ui/mastery-frame-geometry.test.ts` | `src/game/ui/creatures/mastery-frame-geometry.test.ts` |  |
| `src/game/ui/mastery-frame-geometry.ts` | `src/game/ui/creatures/mastery-frame-geometry.ts` |  |
| `src/game/ui/mastery-frame.ts` | `src/game/ui/creatures/mastery-frame.ts` |  |
| `src/game/ui/next-creature-badge.ts` | `src/game/ui/creatures/next-creature-badge.ts` |  |
| `src/game/ui/next-creature-label.test.ts` | `src/game/ui/creatures/next-creature-label.test.ts` |  |
| `src/game/ui/next-creature-label.ts` | `src/game/ui/creatures/next-creature-label.ts` |  |
| `src/game/ui/number-roll.test.ts` | `src/game/ui/common/number-roll.test.ts` |  |
| `src/game/ui/number-roll.ts` | `src/game/ui/common/number-roll.ts` |  |
| `src/game/ui/outlined-text.ts` | `src/game/ui/common/outlined-text.ts` |  |
| `src/game/ui/pause-overlay.ts` | `src/game/ui/run/pause-overlay.ts` |  |
| `src/game/ui/resource-tally.ts` | `src/game/ui/economy/resource-tally.ts` |  |
| `src/game/ui/shake-x.ts` | `src/game/ui/common/shake-x.ts` |  |
| `src/game/ui/shared-atlas.ts` | `src/game/ui/common/shared-atlas.ts` |  |
| `src/game/ui/tall-atlas-art.ts` | `src/game/ui/common/tall-atlas-art.ts` |  |
| `src/game/ui/tempo-caption.test.ts` | `src/game/ui/tower/tempo-caption.test.ts` |  |
| `src/game/ui/tempo-caption.ts` | `src/game/ui/tower/tempo-caption.ts` |  |
| `src/game/ui/tempo-chip-layout.test.ts` | `src/game/ui/tower/tempo-chip-layout.test.ts` |  |
| `src/game/ui/tempo-chip-layout.ts` | `src/game/ui/tower/tempo-chip-layout.ts` |  |
| `src/game/ui/tempo-chip.ts` | `src/game/ui/tower/tempo-chip.ts` |  |
| `src/game/ui/texture-ref-cache.test.ts` | `src/game/ui/common/texture-ref-cache.test.ts` |  |
| `src/game/ui/texture-ref-cache.ts` | `src/game/ui/common/texture-ref-cache.ts` |  |
| `src/game/ui/transition.ts` | `src/game/ui/common/transition.ts` |  |
| `src/game/ui/treasure-flights.ts` | `src/game/ui/economy/treasure-flights.ts` |  |
| `src/game/ui/treasure-hud.ts` | `src/game/ui/economy/treasure-hud.ts` |  |
| `src/game/ui/ui-regions.ts` | `src/game/ui/common/ui-regions.ts` |  |
| `src/game/ui/wobble-bar.ts` | `src/game/ui/tower/wobble-bar.ts` | качка башни в HUD |
| `src/game/ui/zone-change-watch.test.ts` | `src/game/ui/zones/zone-change-watch.test.ts` |  |
| `src/game/ui/zone-change-watch.ts` | `src/game/ui/zones/zone-change-watch.ts` |  |
| `src/game/ui/zone-plate.ts` | `src/game/ui/zones/zone-plate.ts` |  |

## src/game/ui/menu (118)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/game/ui/menu/ad-unavailable.ts` | `src/game/ui/menu/widgets/ad-unavailable.ts` |  |
| `src/game/ui/menu/checkpoint-model.test.ts` | `src/game/ui/menu/checkpoint/checkpoint-model.test.ts` |  |
| `src/game/ui/menu/checkpoint-model.ts` | `src/game/ui/menu/checkpoint/checkpoint-model.ts` |  |
| `src/game/ui/menu/checkpoint-step.ts` | `src/game/ui/menu/checkpoint/checkpoint-step.ts` |  |
| `src/game/ui/menu/checkpoint-window.ts` | `src/game/ui/menu/checkpoint/checkpoint-window.ts` |  |
| `src/game/ui/menu/chest-box.ts` | `src/game/ui/menu/missions/chest-box.ts` | нужно только сундуку заданий |
| `src/game/ui/menu/collection-count.ts` | `src/game/ui/menu/collection/collection-count.ts` |  |
| `src/game/ui/menu/collection-grid.test.ts` | `src/game/ui/menu/collection/collection-grid.test.ts` |  |
| `src/game/ui/menu/collection-grid.ts` | `src/game/ui/menu/collection/collection-grid.ts` |  |
| `src/game/ui/menu/collection-tile.ts` | `src/game/ui/menu/collection/collection-tile.ts` |  |
| `src/game/ui/menu/confirm-window.ts` | `src/game/ui/menu/settings/confirm-window.ts` | нужно только окну настроек |
| `src/game/ui/menu/creature-card.ts` | `src/game/ui/menu/widgets/creature-card.ts` |  |
| `src/game/ui/menu/daily-ad-button.ts` | `src/game/ui/menu/daily/daily-ad-button.ts` |  |
| `src/game/ui/menu/daily-attempts.ts` | `src/game/ui/menu/daily/daily-attempts.ts` |  |
| `src/game/ui/menu/daily-date.ts` | `src/game/ui/menu/daily/daily-date.ts` |  |
| `src/game/ui/menu/daily-intro.ts` | `src/game/ui/menu/daily/daily-intro.ts` |  |
| `src/game/ui/menu/daily-lock.ts` | `src/game/ui/menu/daily/daily-lock.ts` |  |
| `src/game/ui/menu/daily-play.ts` | `src/game/ui/menu/daily/daily-play.ts` |  |
| `src/game/ui/menu/daily-rewards.ts` | `src/game/ui/menu/daily/daily-rewards.ts` |  |
| `src/game/ui/menu/daily-section.ts` | `src/game/ui/menu/daily/daily-section.ts` |  |
| `src/game/ui/menu/daily-team.ts` | `src/game/ui/menu/daily/daily-team.ts` |  |
| `src/game/ui/menu/daily-text.ts` | `src/game/ui/menu/daily/daily-text.ts` |  |
| `src/game/ui/menu/detail-actions.ts` | `src/game/ui/menu/detail/detail-actions.ts` |  |
| `src/game/ui/menu/detail-bio.ts` | `src/game/ui/menu/detail/detail-bio.ts` |  |
| `src/game/ui/menu/detail-info.ts` | `src/game/ui/menu/detail/detail-info.ts` |  |
| `src/game/ui/menu/detail-model.test.ts` | `src/game/ui/menu/detail/detail-model.test.ts` |  |
| `src/game/ui/menu/detail-model.ts` | `src/game/ui/menu/detail/detail-model.ts` |  |
| `src/game/ui/menu/detail-rows.test.ts` | `src/game/ui/menu/detail/detail-rows.test.ts` |  |
| `src/game/ui/menu/detail-rows.ts` | `src/game/ui/menu/detail/detail-rows.ts` |  |
| `src/game/ui/menu/detail-stage.ts` | `src/game/ui/menu/detail/detail-stage.ts` |  |
| `src/game/ui/menu/explainer-window.ts` | `src/game/ui/menu/widgets/explainer-window.ts` |  |
| `src/game/ui/menu/fit-text.ts` | `src/game/ui/menu/widgets/fit-text.ts` |  |
| `src/game/ui/menu/flame-icon.ts` | `src/game/ui/menu/widgets/flame-icon.ts` |  |
| `src/game/ui/menu/gift-window.ts` | `src/game/ui/menu/home/gift-window.ts` | открывается только с Home |
| `src/game/ui/menu/home-badges.ts` | `src/game/ui/menu/home/home-badges.ts` |  |
| `src/game/ui/menu/home-hint.ts` | `src/game/ui/menu/home/home-hint.ts` |  |
| `src/game/ui/menu/home-nav-marks.ts` | `src/game/ui/menu/home/home-nav-marks.ts` |  |
| `src/game/ui/menu/home-nav.ts` | `src/game/ui/menu/home/home-nav.ts` |  |
| `src/game/ui/menu/home-plates.ts` | `src/game/ui/menu/home/home-plates.ts` |  |
| `src/game/ui/menu/home-shelf-math.test.ts` | `src/game/ui/menu/home/home-shelf-math.test.ts` |  |
| `src/game/ui/menu/home-shelf-math.ts` | `src/game/ui/menu/home/home-shelf-math.ts` |  |
| `src/game/ui/menu/home-shelf.ts` | `src/game/ui/menu/home/home-shelf.ts` |  |
| `src/game/ui/menu/home-start-from.ts` | `src/game/ui/menu/home/home-start-from.ts` |  |
| `src/game/ui/menu/home-starter.ts` | `src/game/ui/menu/home/home-starter.ts` |  |
| `src/game/ui/menu/hop-motion.ts` | `src/game/ui/menu/widgets/hop-motion.ts` |  |
| `src/game/ui/menu/icon-button.ts` | `src/game/ui/menu/widgets/icon-button.ts` |  |
| `src/game/ui/menu/level-up-chain.ts` | `src/game/ui/menu/results/level-up-chain.ts` | новый уровень на результатах; открывается и из заданий |
| `src/game/ui/menu/level-up-panel.ts` | `src/game/ui/menu/results/level-up-panel.ts` |  |
| `src/game/ui/menu/mastery-transform.ts` | `src/game/ui/menu/detail/mastery-transform.ts` |  |
| `src/game/ui/menu/missions-card.ts` | `src/game/ui/menu/missions/missions-card.ts` |  |
| `src/game/ui/menu/missions-chest.ts` | `src/game/ui/menu/missions/missions-chest.ts` |  |
| `src/game/ui/menu/missions-model.test.ts` | `src/game/ui/menu/missions/missions-model.test.ts` |  |
| `src/game/ui/menu/missions-model.ts` | `src/game/ui/menu/missions/missions-model.ts` |  |
| `src/game/ui/menu/missions-window.ts` | `src/game/ui/menu/missions/missions-window.ts` |  |
| `src/game/ui/menu/new-creature-box.ts` | `src/game/ui/menu/new-creature/new-creature-box.ts` |  |
| `src/game/ui/menu/new-creature-rays.ts` | `src/game/ui/menu/new-creature/new-creature-rays.ts` |  |
| `src/game/ui/menu/new-creature-reveal.test.ts` | `src/game/ui/menu/new-creature/new-creature-reveal.test.ts` |  |
| `src/game/ui/menu/new-creature-reveal.ts` | `src/game/ui/menu/new-creature/new-creature-reveal.ts` |  |
| `src/game/ui/menu/new-creature-sequence.ts` | `src/game/ui/menu/new-creature/new-creature-sequence.ts` |  |
| `src/game/ui/menu/no-more-starts-note.ts` | `src/game/ui/menu/checkpoint/no-more-starts-note.ts` |  |
| `src/game/ui/menu/oven-mark.ts` | `src/game/ui/menu/oven/oven-mark.ts` |  |
| `src/game/ui/menu/oven-picture.ts` | `src/game/ui/menu/oven/oven-picture.ts` |  |
| `src/game/ui/menu/oven-plate.ts` | `src/game/ui/menu/oven/oven-plate.ts` |  |
| `src/game/ui/menu/oven-window.ts` | `src/game/ui/menu/oven/oven-window.ts` |  |
| `src/game/ui/menu/padlock.ts` | `src/game/ui/menu/widgets/padlock.ts` |  |
| `src/game/ui/menu/premium-offer.ts` | `src/game/ui/menu/shop/premium-offer.ts` | предложение товара магазина после межстраничной рекламы |
| `src/game/ui/menu/price-tag.ts` | `src/game/ui/menu/widgets/price-tag.ts` |  |
| `src/game/ui/menu/progress-bar.ts` | `src/game/ui/menu/widgets/progress-bar.ts` |  |
| `src/game/ui/menu/results-buttons.ts` | `src/game/ui/menu/results/results-buttons.ts` |  |
| `src/game/ui/menu/results-coins.ts` | `src/game/ui/menu/results/results-coins.ts` |  |
| `src/game/ui/menu/results-debug-plate.ts` | `src/game/ui/menu/results/results-debug-plate.ts` |  |
| `src/game/ui/menu/results-flow.ts` | `src/game/ui/menu/results/results-flow.ts` |  |
| `src/game/ui/menu/results-header.ts` | `src/game/ui/menu/results/results-header.ts` |  |
| `src/game/ui/menu/results-hint.ts` | `src/game/ui/menu/results/results-hint.ts` |  |
| `src/game/ui/menu/results-layout.test.ts` | `src/game/ui/menu/results/results-layout.test.ts` |  |
| `src/game/ui/menu/results-layout.ts` | `src/game/ui/menu/results/results-layout.ts` |  |
| `src/game/ui/menu/results-missions.ts` | `src/game/ui/menu/results/results-missions.ts` |  |
| `src/game/ui/menu/results-panel.ts` | `src/game/ui/menu/results/results-panel.ts` |  |
| `src/game/ui/menu/results-share.ts` | `src/game/ui/menu/results/results-share.ts` |  |
| `src/game/ui/menu/results-start-model.test.ts` | `src/game/ui/menu/results/results-start-model.test.ts` |  |
| `src/game/ui/menu/results-start-model.ts` | `src/game/ui/menu/results/results-start-model.ts` |  |
| `src/game/ui/menu/results-start.ts` | `src/game/ui/menu/results/results-start.ts` |  |
| `src/game/ui/menu/results-text.test.ts` | `src/game/ui/menu/results/results-text.test.ts` |  |
| `src/game/ui/menu/results-text.ts` | `src/game/ui/menu/results/results-text.ts` |  |
| `src/game/ui/menu/results-tiers.ts` | `src/game/ui/menu/results/results-tiers.ts` |  |
| `src/game/ui/menu/results-xp.ts` | `src/game/ui/menu/results/results-xp.ts` |  |
| `src/game/ui/menu/reward-flight.ts` | `src/game/ui/menu/widgets/reward-flight.ts` | берут несколько экранов |
| `src/game/ui/menu/screen-header.ts` | `src/game/ui/menu/widgets/screen-header.ts` |  |
| `src/game/ui/menu/setting-toggles.ts` | `src/game/ui/menu/settings/setting-toggles.ts` |  |
| `src/game/ui/menu/settings-window.ts` | `src/game/ui/menu/settings/settings-window.ts` |  |
| `src/game/ui/menu/share-card-layout.test.ts` | `src/game/ui/menu/results/share-card-layout.test.ts` |  |
| `src/game/ui/menu/share-card-layout.ts` | `src/game/ui/menu/results/share-card-layout.ts` |  |
| `src/game/ui/menu/share-card.ts` | `src/game/ui/menu/results/share-card.ts` |  |
| `src/game/ui/menu/shop-blocks.ts` | `src/game/ui/menu/shop/shop-blocks.ts` |  |
| `src/game/ui/menu/shop-premium-icon.ts` | `src/game/ui/menu/shop/shop-premium-icon.ts` |  |
| `src/game/ui/menu/shop-row.ts` | `src/game/ui/menu/shop/shop-row.ts` |  |
| `src/game/ui/menu/shop-starter.ts` | `src/game/ui/menu/shop/shop-starter.ts` |  |
| `src/game/ui/menu/shop-toast.ts` | `src/game/ui/menu/shop/shop-toast.ts` |  |
| `src/game/ui/menu/stars.ts` | `src/game/ui/menu/widgets/stars.ts` |  |
| `src/game/ui/menu/start-choice.ts` | `src/game/ui/menu/checkpoint/start-choice.ts` | старт с точки (Home и результаты) |
| `src/game/ui/menu/start-from-button.ts` | `src/game/ui/menu/checkpoint/start-from-button.ts` |  |
| `src/game/ui/menu/streak-calendar.ts` | `src/game/ui/menu/streak/streak-calendar.ts` |  |
| `src/game/ui/menu/streak-cell.ts` | `src/game/ui/menu/streak/streak-cell.ts` |  |
| `src/game/ui/menu/streak-threat.ts` | `src/game/ui/menu/streak/streak-threat.ts` |  |
| `src/game/ui/menu/streak-windows.ts` | `src/game/ui/menu/streak/streak-windows.ts` |  |
| `src/game/ui/menu/team-gesture.test.ts` | `src/game/ui/menu/team/team-gesture.test.ts` |  |
| `src/game/ui/menu/team-gesture.ts` | `src/game/ui/menu/team/team-gesture.ts` |  |
| `src/game/ui/menu/team-grid.ts` | `src/game/ui/menu/team/team-grid.ts` |  |
| `src/game/ui/menu/team-layout.test.ts` | `src/game/ui/menu/team/team-layout.test.ts` |  |
| `src/game/ui/menu/team-layout.ts` | `src/game/ui/menu/team/team-layout.ts` |  |
| `src/game/ui/menu/team-order-plate.ts` | `src/game/ui/menu/team/team-order-plate.ts` |  |
| `src/game/ui/menu/team-slots.ts` | `src/game/ui/menu/team/team-slots.ts` |  |
| `src/game/ui/menu/time-text.test.ts` | `src/game/ui/menu/widgets/time-text.test.ts` |  |
| `src/game/ui/menu/time-text.ts` | `src/game/ui/menu/widgets/time-text.ts` |  |
| `src/game/ui/menu/transform-plan.test.ts` | `src/game/ui/menu/detail/transform-plan.test.ts` |  |
| `src/game/ui/menu/transform-plan.ts` | `src/game/ui/menu/detail/transform-plan.ts` |  |
| `src/game/ui/menu/unlock-text.ts` | `src/game/ui/menu/widgets/unlock-text.ts` |  |
| `src/game/ui/menu/xp-bar.ts` | `src/game/ui/menu/widgets/xp-bar.ts` |  |

## src/game (корень) (62)

| Старый путь | Новый путь | Почему |
|---|---|---|
| `src/game/ad-caption.test.ts` | `src/game/economy/ad-caption.test.ts` |  |
| `src/game/ad-caption.ts` | `src/game/economy/ad-caption.ts` |  |
| `src/game/apply-settings.ts` | `src/game/app/apply-settings.ts` |  |
| `src/game/audio-lifecycle.ts` | `src/game/audio/audio-lifecycle.ts` |  |
| `src/game/audio-unlock.ts` | `src/game/audio/audio-unlock.ts` |  |
| `src/game/camera-layout.test.ts` | `src/game/run/camera-layout.test.ts` |  |
| `src/game/camera-layout.ts` | `src/game/run/camera-layout.ts` |  |
| `src/game/checkpoint-interstitial.test.ts` | `src/game/economy/checkpoint-interstitial.test.ts` | проверяет межстраничную рекламу после старта с точки |
| `src/game/checkpoint-start.test.ts` | `src/game/run/checkpoint-start.test.ts` |  |
| `src/game/checkpoint-start.ts` | `src/game/run/checkpoint-start.ts` | старт забега с контрольной точки |
| `src/game/clip-guard.ts` | `src/game/common/clip-guard.ts` | нужен bake-texture и листу картинок |
| `src/game/config.ts` | `src/game/app/config.ts` |  |
| `src/game/continue-flow.test.ts` | `src/game/run/continue-flow.test.ts` |  |
| `src/game/continue-flow.ts` | `src/game/run/continue-flow.ts` |  |
| `src/game/continue-input.test.ts` | `src/game/run/continue-input.test.ts` |  |
| `src/game/continue-input.ts` | `src/game/run/continue-input.ts` |  |
| `src/game/depth.ts` | `src/game/common/depth.ts` |  |
| `src/game/dev-warn.ts` | `src/game/common/dev-warn.ts` |  |
| `src/game/drop-driver-slot.ts` | `src/game/run/drop-driver-slot.ts` | кто касается экрана в забеге |
| `src/game/effects-mode.test.ts` | `src/game/app/effects-mode.test.ts` |  |
| `src/game/effects-mode.ts` | `src/game/app/effects-mode.ts` |  |
| `src/game/follow-density.ts` | `src/game/app/follow-density.ts` |  |
| `src/game/frame-work.ts` | `src/game/app/frame-work.ts` |  |
| `src/game/fx-guard.test.ts` | `src/game/common/fx-guard.test.ts` |  |
| `src/game/fx-guard.ts` | `src/game/common/fx-guard.ts` |  |
| `src/game/fx-sound.ts` | `src/game/audio/fx-sound.ts` |  |
| `src/game/interstitial-flow.test.ts` | `src/game/economy/interstitial-flow.test.ts` |  |
| `src/game/interstitial-flow.ts` | `src/game/economy/interstitial-flow.ts` |  |
| `src/game/music-cues.ts` | `src/game/audio/music-cues.ts` |  |
| `src/game/per-scene.test.ts` | `src/game/common/per-scene.test.ts` |  |
| `src/game/per-scene.ts` | `src/game/common/per-scene.ts` |  |
| `src/game/purchases.ts` | `src/game/economy/purchases.ts` |  |
| `src/game/render-density.ts` | `src/game/app/render-density.ts` |  |
| `src/game/results-data.test.ts` | `src/game/run/results-data.test.ts` |  |
| `src/game/results-data.ts` | `src/game/run/results-data.ts` |  |
| `src/game/results-launch.ts` | `src/game/run/results-launch.ts` |  |
| `src/game/rewarded.test.ts` | `src/game/economy/rewarded.test.ts` |  |
| `src/game/rewarded.ts` | `src/game/economy/rewarded.ts` |  |
| `src/game/run-camera.ts` | `src/game/run/run-camera.ts` |  |
| `src/game/run-crediting.test.ts` | `src/game/run/run-crediting.test.ts` | проверяет запись забега (run-recorder, results-data) |
| `src/game/run-exit.test.ts` | `src/game/run/run-exit.test.ts` |  |
| `src/game/run-exit.ts` | `src/game/run/run-exit.ts` |  |
| `src/game/run-info.ts` | `src/game/run/run-info.ts` |  |
| `src/game/run-look-choice.test.ts` | `src/game/weather/run-look-choice.test.ts` |  |
| `src/game/run-look-choice.ts` | `src/game/weather/run-look-choice.ts` |  |
| `src/game/run-recorder.test.ts` | `src/game/run/run-recorder.test.ts` |  |
| `src/game/run-recorder.ts` | `src/game/run/run-recorder.ts` |  |
| `src/game/run-request.test.ts` | `src/game/run/run-request.test.ts` |  |
| `src/game/run-request.ts` | `src/game/run/run-request.ts` |  |
| `src/game/run-restart.test.ts` | `src/game/run/run-restart.test.ts` |  |
| `src/game/run-restart.ts` | `src/game/run/run-restart.ts` |  |
| `src/game/run-setup.test.ts` | `src/game/run/run-setup.test.ts` |  |
| `src/game/run-setup.ts` | `src/game/run/run-setup.ts` |  |
| `src/game/run-telemetry.test.ts` | `src/game/run/run-telemetry.test.ts` |  |
| `src/game/run-telemetry.ts` | `src/game/run/run-telemetry.ts` |  |
| `src/game/safe-sides.ts` | `src/game/app/safe-sides.ts` |  |
| `src/game/scene-keys.test.ts` | `src/game/app/scene-keys.test.ts` |  |
| `src/game/scene-keys.ts` | `src/game/app/scene-keys.ts` |  |
| `src/game/treasure-events.ts` | `src/game/economy/treasure-events.ts` |  |
| `src/game/weather-bed.test.ts` | `src/game/audio/weather-bed.test.ts` |  |
| `src/game/weather-bed.ts` | `src/game/audio/weather-bed.ts` | звук погоды |
| `src/game/webgl-renderer.ts` | `src/game/app/webgl-renderer.ts` |  |
