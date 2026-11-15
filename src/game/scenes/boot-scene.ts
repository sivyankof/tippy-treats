import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { readDebugParams } from '../../util/debug-params';
import { services } from '../../services';
import { bindAudioLifecycle } from '../audio-lifecycle';
import { bindSystemReducedMotion, effectsMode } from '../effects-mode';
import { bindFrameWork } from '../frame-work';
import { createAbilityTextures } from '../fx/abilities/ability-textures';
import { createFxTextures } from '../fx/fx-textures';
import { FACE_TEXTURES } from '../objects/face-textures';
import { loadSvgTextures } from '../objects/svg-textures';
import { TEMPO_ICON_KEY } from '../ui/creature-icons';
import { createCreatureIconTextures } from '../objects/creature-icon-textures';
import { SCENES, startRunFrom } from '../scene-keys';
import { createPileTextures } from '../fx/treasure-pile';
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
    loadSvgTextures(this, [TEMPO_ICON_KEY], HUD_LAYOUT.iconTextureScale);
  }

  create(): void {
    createFxTextures(this);
    createAbilityTextures(this);
    bindAudioLifecycle(this.game, services.audio);
    bindSystemReducedMotion(effectsMode);
    bindFrameWork(this.game);
    if (readDebugParams().lineup) {
      this.scene.start(SCENES.lineup);
      return;
    }
    createTreasureTextures(this);
    createPileTextures(this);
    createCreatureIconTextures(this);
    if (opensWithRun() || !gameState.hasHint('tutorial')) {
      startRunFrom(this);
      return;
    }
    this.scene.start(SCENES.home);
  }
}
