import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { readDebugParams } from '../../util/debug-params';
import { services } from '../../services';
import { bindAudioLifecycle } from '../audio-lifecycle';
import { bindSystemReducedMotion, effectsMode } from '../effects-mode';
import { createAbilityTextures } from '../fx/abilities/ability-textures';
import { createFxTextures } from '../fx/fx-textures';
import { FACE_TEXTURES } from '../objects/face-textures';
import { loadSvgTextures } from '../objects/svg-textures';
import { CREATURE_ICON_KEYS } from '../ui/creature-icons';
import { SCENES, startRunFrom } from '../scene-keys';
import { createTreasureTextures } from '../fx/treasure-textures';
import { opensWithRun } from '../run-setup';
import { gameState } from '../../state';

/**
 * Prepares shared textures, then opens the first screen: the tutorial run on the very first
 * launch (and any run asked for by dev parameters), Home otherwise.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    loadSvgTextures(this, Object.values(FACE_TEXTURES));
    loadSvgTextures(this, Object.values(CREATURE_ICON_KEYS), HUD_LAYOUT.iconTextureScale);
  }

  create(): void {
    createFxTextures(this);
    createAbilityTextures(this);
    bindAudioLifecycle(this.game, services.audio);
    bindSystemReducedMotion(effectsMode);
    if (readDebugParams().lineup) {
      this.scene.start(SCENES.lineup);
      return;
    }
    createTreasureTextures(this);
    if (opensWithRun() || !gameState.hasHint('tutorial')) {
      startRunFrom(this);
      return;
    }
    this.scene.start(SCENES.home);
  }
}
