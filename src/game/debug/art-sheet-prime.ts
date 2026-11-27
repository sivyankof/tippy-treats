import type * as Phaser from 'phaser';
import { ART_SHEET } from '../../data/debug/art-sheet';
import { CREATURE_IDS } from '../../data/creatures/creatures';
import { TOWER_GUESTS } from '../../data/guests/tower-guest';
import { createAbilityTextures } from '../fx/abilities/ability-textures';
import { bakeCheckpointTextures } from '../fx/zones/checkpoint-textures';
import { bakeClimbFrame, bakeClimbMapTextures } from '../fx/zones/climb-map-textures';
import { bakeJournalDishes, bakeJournalIcons } from '../fx/journal/journal-textures';
import { bakeOfflineIcon } from '../fx/economy/offline-icon-texture';
import { bakeVideoIcon } from '../fx/economy/video-icon-texture';
import { bakeChestTextures } from '../fx/economy/chest-texture';
import { bakeCutTextures } from '../fx/cuts/cut-textures';
import { createFxTextures } from '../fx/common/fx-textures';
import { bakeSquashTextures } from '../fx/toppers/squash-textures';
import { bakeGiftTextures } from '../fx/economy/gift-texture';
import { bakeTowerSparkle } from '../fx/tower/tower-sparkles';
import { bakeOvenTextures } from '../fx/economy/oven-texture';
import { createRewardTextures } from '../fx/economy/reward-pictures';
import { createPileTextures } from '../fx/economy/treasure-pile';
import { createTreasureTextures, TREASURE_TEXTURES } from '../fx/economy/treasure-textures';
import { bakeNebulaArms, nebulaLayout } from '../fx/zones/nebula-arms';
import { bakeLapEdge } from '../fx/zones/lap-edges';
import { bakeSharedArt } from '../objects/backdrop/common/art-kit';
import { bakeSpaceVisitors } from '../objects/backdrop/space/space-visitor-art';
import { bakeAllPlanets } from '../objects/backdrop/space/dessert-planets';
import { bakeAllFarArt } from '../objects/backdrop/zones/far-plane';
import { kitchenArt } from '../objects/backdrop/zones/kitchen-zone';
import { shopArt } from '../objects/backdrop/zones/shop-zone';
import { showcaseArt } from '../objects/backdrop/zones/showcase-zone';
import { bakeMountains } from '../objects/backdrop/zones/mountains';
import { roofArt } from '../objects/backdrop/zones/roof-zone';
import { bakeAllWeatherSky, bakeWeatherArt } from '../objects/backdrop/weather/weather-art';
import {
  createCreatureIconTextures,
  createGrownCreatureIconTextures,
} from '../objects/creatures/creature-icon-textures';
import { bakeShadeTextures } from '../objects/tower/layer-shade';
import { ensureSleepTexture } from '../objects/creatures/sleep-silhouette';
import { bakeGuestFlat } from '../objects/guests/tower-guest-art';
import { bakeTopperTextures } from '../fx/toppers/topper-texture';
import { bakeHintTextures } from '../tutorial/hint-textures';
import { bakeGoalLine, bakeGoalPlate } from '../fx/run/goal-line';
import { GOAL_LINE } from '../../data/run/goal-line';
import { bakeTongue } from '../objects/glaze/tongue-view';
import { bakeStripTextures } from '../objects/glaze/tongue-strip-texture';
import { bakeMasteryFrame } from '../ui/creatures/mastery-frame';
import { bakeHudGlyphs } from '../ui/creatures/hud-glyphs';
import { bakeRunVolumeGlyphs } from '../ui/run/run-volume-styles';
import { bakeScoreStar } from '../fx/economy/score-star-texture';
import { bakeTileMark } from '../ui/style/stat-tile';
import { bakeCalloutArrow } from '../ui/style/callout';

/**
 * Pictures that the game bakes lazily (on first use) or in the boot scene are baked here so they
 * land on the art sheet, which opens before the boot bakers run. A new baker needs one line in
 * this list.
 */
const PRIME_STEPS: ReadonlyArray<(scene: Phaser.Scene) => void> = [
  createFxTextures,
  bakeSquashTextures,
  bakeCutTextures,
  createAbilityTextures,
  createTreasureTextures,
  (scene) => bakeNebulaArms(scene, TREASURE_TEXTURES.nebula, nebulaLayout(scene.scale.height)),
  bakeLapEdge,
  createPileTextures,
  createRewardTextures,
  bakeOvenTextures,
  createCreatureIconTextures,
  createGrownCreatureIconTextures,
  bakeMasteryFrame,
  bakeHudGlyphs,
  bakeRunVolumeGlyphs,
  bakeSharedArt,
  bakeAllFarArt,
  bakeSpaceVisitors,
  bakeMountains,
  (scene) => bakeWeatherArt(scene, 'all'),
  bakeAllWeatherSky,
  // The night house layers of the Roof (lit windows).
  (scene) => roofArt.bake(scene, { lap: 1, weather: 'night', place: 'kitchen', planetSeed: 0 }),
  bakeAllPlanets,
  bakePlaceArt,
  bakeTowerSparkle,
  bakeHintTextures,
  bakeTongue,
  bakeStripTextures,
  bakeChestTextures,
  bakeCheckpointTextures,
  bakeClimbMapTextures,
  (scene) => bakeClimbFrame(scene, 804, 600),
  bakeOfflineIcon,
  bakeJournalIcons,
  bakeJournalDishes,
  bakeVideoIcon,
  bakeScoreStar,
  bakeTileMark,
  bakeCalloutArrow,
  bakeGoalLine,
  (scene) => {
    bakeGoalPlate(scene, GOAL_LINE.plate.sheetWidth, GOAL_LINE.colors.record.plate, false);
    bakeGoalPlate(scene, GOAL_LINE.plate.sheetWidth, GOAL_LINE.colors.yesterday.plate, true);
  },
  (scene) => bakeShadeTextures(scene),
  bakeTopperTextures,
  (scene) => bakeGiftTextures(scene, false),
  (scene) => bakeGiftTextures(scene, true),
  (scene) => {
    for (const look of Object.values(TOWER_GUESTS)) bakeGuestFlat(scene, look);
  },
  (scene) => {
    for (const id of CREATURE_IDS) ensureSleepTexture(scene, id, ART_SHEET.sleepLayerWidth);
  },
];

/** The pictures of the start places and the Showcase for a few weathers, so the sheet shows the sky colours, the glass items and both places. */
function bakePlaceArt(scene: Phaser.Scene): void {
  for (const weather of ['clear', 'sunset', 'rain', 'storm', 'night', 'snow', 'leaves'] as const) {
    const look = { lap: 1, weather, place: 'kitchen', planetSeed: 0 } as const;
    kitchenArt.bake(scene, look);
    shopArt.bake(scene, { ...look, place: 'shop' });
    showcaseArt.bake(scene, look);
  }
}

/** Bakes every lazy picture of the game into the texture registry. */
export function primeArtTextures(scene: Phaser.Scene): void {
  for (const step of PRIME_STEPS) step(scene);
}
