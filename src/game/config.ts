import * as Phaser from 'phaser';
import { LOGICAL_SIZE } from '../data/screen';
import { computeLogicalSize, type LogicalSize } from '../util/logical-size';
import { BootScene } from './scenes/boot-scene';

export const FONT_FAMILY = 'Nunito';
export const FONT_WEIGHT = { extraBold: '800', black: '900' } as const;

export const COLORS = {
  background: 0xfff3e0,
  textPrimary: '#5b3a29',
  textSecondary: '#a07a62',
} as const;

export function logicalSizeFor(parent: HTMLElement): LogicalSize {
  return computeLogicalSize(parent.clientWidth, parent.clientHeight, LOGICAL_SIZE);
}

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  const size = logicalSizeFor(parent);
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
    },
    scene: [BootScene],
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
