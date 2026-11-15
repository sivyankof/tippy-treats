import type * as Phaser from 'phaser';
import { collectBakeSteps, type BakeStep } from '../ui/bake-texture';
import { bakeOvenTextures } from './oven-texture';

/**
 * The pictures the results screen needs that do not depend on the run, as bakes to do one per
 * frame during the run, so the frame that creates the screen finds them ready.
 */
export function resultsBakeSteps(scene: Phaser.Scene): BakeStep[] {
  return collectBakeSteps(() => {
    bakeOvenTextures(scene);
  });
}
