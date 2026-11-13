import * as Phaser from 'phaser';
import { LOGICAL_SIZE } from '../data/screen';
import { computeLogicalSize, type LogicalSize } from '../util/logical-size';
import { KITCHEN_COLORS } from '../data/palette';
import { BootScene } from './scenes/boot-scene';
import { GameScene } from './scenes/game-scene';
import { HudScene } from './scenes/hud-scene';
import { ResultsScene } from './scenes/results-scene';

export function logicalSizeFor(parent: HTMLElement): LogicalSize {
  return computeLogicalSize(parent.clientWidth, parent.clientHeight, LOGICAL_SIZE);
}

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  const size = logicalSizeFor(parent);
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: KITCHEN_COLORS.skyTop,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
    },
    // Sound effects go through src/services/audio, which creates its only AudioContext
    // inside a user gesture; Phaser's own sound manager stays off.
    audio: { noAudio: true },
    // Order is draw order: the HUD sits above the run, results above both.
    scene: [BootScene, GameScene, HudScene, ResultsScene],
  };
}

/**
 * Keeps the logical height in sync with the parent proportions.
 * Scenes get the new size through the scale manager `resize` event.
 */
export function bindLogicalResize(game: Phaser.Game, parent: HTMLElement): void {
  const apply = (): void => {
    const size = logicalSizeFor(parent);
    game.scale.getParentBounds();
    if (size.height !== game.scale.gameSize.height) {
      game.scale.setGameSize(size.width, size.height);
    } else {
      game.scale.refresh();
    }
  };
  new ResizeObserver(apply).observe(parent);
}
