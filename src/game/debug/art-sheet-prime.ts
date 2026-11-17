import type * as Phaser from 'phaser';
import { ART_SHEET } from '../../data/art-sheet';
import { CREATURE_IDS } from '../../data/creatures';
import { TOWER_GUESTS } from '../../data/tower-guest';
import { createAbilityTextures } from '../fx/abilities/ability-textures';
import { bakeCheckpointTextures } from '../fx/checkpoint-textures';
import { bakeOfflineIcon } from '../fx/offline-icon-texture';
import { bakeChestTextures } from '../fx/chest-texture';
import { createFxTextures } from '../fx/fx-textures';
import { bakeGiftTextures } from '../fx/gift-texture';
import { bakeTowerSparkle } from '../fx/tower-sparkles';
import { bakeOvenTextures } from '../fx/oven-texture';
import { createRewardTextures } from '../fx/reward-pictures';
import { createPileTextures } from '../fx/treasure-pile';
import { createTreasureTextures } from '../fx/treasure-textures';
import { bakeLapEdge } from '../fx/lap-edges';
import { bakeSharedArt } from '../objects/backdrop/art-kit';
import { bakeSpaceVisitors } from '../objects/backdrop/space-visitor-art';
import { bakeAllPlanets } from '../objects/backdrop/dessert-planets';
import { bakeAllFarArt } from '../objects/backdrop/far-plane';
import { bakeMountains } from '../objects/backdrop/mountains';
import { roofArt } from '../objects/backdrop/roof-zone';
import { bakeWeatherArt } from '../objects/backdrop/weather-art';
import {
  createCreatureIconTextures,
  createGrownCreatureIconTextures,
} from '../objects/creature-icon-textures';
import { bakeShadeTextures } from '../objects/layer-shade';
import { ensureSleepTexture } from '../objects/sleep-silhouette';
import { bakeGuestFlat } from '../objects/tower-guest-art';
import { bakeTopperTextures } from '../fx/topper-texture';
import { bakeHintTextures } from '../tutorial/hint-textures';
import { bakeTongue } from '../objects/tongue-view';
import { bakeStripTextures } from '../objects/tongue-strip-texture';
import { bakeMasteryFrame } from '../ui/mastery-frame';

/**
 * Pictures that the game bakes lazily (on first use) or in the boot scene are baked here so they
 * land on the art sheet, which opens before the boot bakers run. A new baker needs one line in
 * this list.
 */
const PRIME_STEPS: ReadonlyArray<(scene: Phaser.Scene) => void> = [
  createFxTextures,
  createAbilityTextures,
  createTreasureTextures,
  bakeLapEdge,
  createPileTextures,
  createRewardTextures,
  bakeOvenTextures,
  createCreatureIconTextures,
  createGrownCreatureIconTextures,
  bakeMasteryFrame,
  bakeSharedArt,
  bakeAllFarArt,
  bakeSpaceVisitors,
  bakeMountains,
  (scene) => bakeWeatherArt(scene, 'all'),
  // The night house layers of the Roof (lit windows).
  (scene) => roofArt.bake(scene, { lap: 1, weather: 'night', place: 'kitchen' }),
  bakeAllPlanets,
  bakeTowerSparkle,
  bakeHintTextures,
  bakeTongue,
  bakeStripTextures,
  bakeChestTextures,
  bakeCheckpointTextures,
  bakeOfflineIcon,
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

/** Bakes every lazy picture of the game into the texture registry. */
export function primeArtTextures(scene: Phaser.Scene): void {
  for (const step of PRIME_STEPS) step(scene);
}
