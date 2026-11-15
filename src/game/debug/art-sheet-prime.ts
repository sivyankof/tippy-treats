import type * as Phaser from 'phaser';
import { ART_SHEET } from '../../data/art-sheet';
import { CREATURE_IDS } from '../../data/creatures';
import { TOWER_GUESTS } from '../../data/tower-guest';
import { createAbilityTextures } from '../fx/abilities/ability-textures';
import { bakeChestTextures } from '../fx/chest-texture';
import { createFxTextures } from '../fx/fx-textures';
import { bakeGiftTextures } from '../fx/gift-texture';
import { bakeTowerSparkle } from '../fx/tower-sparkles';
import { bakeOvenTextures } from '../fx/oven-texture';
import { createRewardTextures } from '../fx/reward-pictures';
import { createPileTextures } from '../fx/treasure-pile';
import { createTreasureTextures } from '../fx/treasure-textures';
import { bakeSharedArt } from '../objects/backdrop/art-kit';
import { bakeAllFarArt } from '../objects/backdrop/far-plane';
import { createCreatureIconTextures } from '../objects/creature-icon-textures';
import { ensureSleepTexture } from '../objects/sleep-silhouette';
import { bakeGuestFlat } from '../objects/tower-guest-art';
import { bakeHintTextures } from '../tutorial/hint-textures';

/**
 * Pictures that the game bakes lazily (on first use) or in the boot scene are baked here so they
 * land on the art sheet, which opens before the boot bakers run. A new baker needs one line in
 * this list.
 */
const PRIME_STEPS: ReadonlyArray<(scene: Phaser.Scene) => void> = [
  createFxTextures,
  createAbilityTextures,
  createTreasureTextures,
  createPileTextures,
  createRewardTextures,
  bakeOvenTextures,
  createCreatureIconTextures,
  bakeSharedArt,
  bakeAllFarArt,
  bakeTowerSparkle,
  bakeHintTextures,
  bakeChestTextures,
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
