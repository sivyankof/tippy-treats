import * as Phaser from 'phaser';
import { densityCapForLevel } from '../../util/density-scale';
import { effectsMode } from './effects-mode';
import { capRenderDensity } from './render-density';

/** Caps the canvas density by the effects level, now and whenever the automatic mode changes the level. */
export function followEffectsLevelDensity(game: Phaser.Game): void {
  const density = capRenderDensity(game, densityCapForLevel(effectsMode.level));
  if (!density) return;
  // Before the frame is drawn: a new canvas size clears whatever was drawn into it.
  game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
    density.setCap(densityCapForLevel(effectsMode.level));
  });
}
