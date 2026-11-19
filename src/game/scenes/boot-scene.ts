import * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { readDebugParams } from '../../util/debug-params';
import { services } from '../../services';
import { bindAudioLifecycle } from '../audio-lifecycle';
import { bindMenuMusic } from '../music-cues';
import { bindSystemReducedMotion, effectsMode } from '../effects-mode';
import { bindFrameWork } from '../frame-work';
import { createAbilityTextures } from '../fx/abilities/ability-textures';
import { createFxTextures } from '../fx/common/fx-textures';
import { bakeSquashTextures } from '../fx/toppers/squash-textures';
import { FACE_TEXTURES } from '../objects/face-textures';
import { loadSvgTextures } from '../objects/svg-textures';
import { moveToSharedAtlas } from '../ui/shared-atlas';
import { TEMPO_ICON_KEY } from '../ui/creature-icons';
import { createCreatureIconTextures } from '../objects/creature-icon-textures';
import { bakeTallAtlasArt } from '../ui/tall-atlas-art';
import { SCENES, startRunFrom } from '../scene-keys';
import { createRewardTextures } from '../fx/economy/reward-pictures';
import { createPileTextures } from '../fx/economy/treasure-pile';
import { createTreasureTextures } from '../fx/economy/treasure-textures';
import { opensWithRun } from '../run-setup';
import { resultsDemoData } from '../debug/results-demo';
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
    moveToSharedAtlas(this, [...Object.values(FACE_TEXTURES), TEMPO_ICON_KEY]);
    createFxTextures(this);
    bakeSquashTextures(this);
    createAbilityTextures(this);
    bindAudioLifecycle(this.game, services.audio, services.silentMode);
    bindMenuMusic(this.game);
    bindSystemReducedMotion(effectsMode);
    bindFrameWork(this.game);
    if (readDebugParams().lineup) {
      this.scene.start(SCENES.lineup);
      return;
    }
    if (readDebugParams().artsheet) {
      this.scene.start(SCENES.artSheet);
      return;
    }
    createTreasureTextures(this);
    createPileTextures(this);
    createRewardTextures(this);
    createCreatureIconTextures(this);
    bakeTallAtlasArt(this);
    const resultsDemo = import.meta.env.DEV ? readDebugParams().resultsDemo : undefined;
    if (resultsDemo) {
      this.scene.start(SCENES.results, resultsDemoData(resultsDemo));
      return;
    }
    if (opensWithRun() || !gameState.hasHint('tutorial')) {
      startRunFrom(this);
      return;
    }
    this.scene.start(SCENES.home);
  }
}
