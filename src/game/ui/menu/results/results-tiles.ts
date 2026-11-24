import * as Phaser from 'phaser';
import type { RunResult } from '../../../../core/run/run-result';
import { MENU } from '../../../../data/common/menu-layout';
import { formatNumber, t } from '../../../../i18n';
import { createScoreStar } from '../../../fx/economy/score-star-texture';
import { StatTile, type StatTileOptions } from '../../style/stat-tile';

const cfg = MENU.results.tiles;

/** Sizes of a tile of the results `width` wide (all but its icon, caption and tap). */
export function tileLook(width: number): Omit<StatTileOptions, 'icon' | 'label' | 'onTap'> {
  return {
    width,
    height: cfg.height,
    valueFont: cfg.valueFont,
    labelFont: cfg.labelFont,
    iconY: cfg.iconY,
    valueY: cfg.valueY,
    labelY: cfg.labelY,
    padX: cfg.padX,
  };
}

/** Width of each of `count` tiles side by side across `inner`. */
export function tileWidth(inner: number, count: number): number {
  return (inner - cfg.gap * Math.max(0, count - 1)) / Math.max(1, count);
}

/** The score tile: the gold star, the score, "score". */
export function createScoreTile(scene: Phaser.Scene, result: RunResult, width: number): StatTile {
  const icon = createScoreStar(scene).setDisplaySize(cfg.iconSize, cfg.iconSize);
  return new StatTile(scene, { ...tileLook(width), icon, label: t('results.tile.score') }).setValue(
    formatNumber(result.score),
  );
}

/** The tiles side by side, centred on the row. */
export function createTileRow(
  scene: Phaser.Scene,
  tiles: readonly StatTile[],
  width: number,
): Phaser.GameObjects.Container {
  const row = scene.add.container(0, 0);
  tiles.forEach((tile, i) => {
    tile.setX(
      -(width * tiles.length + cfg.gap * (tiles.length - 1)) / 2 +
        width / 2 +
        i * (width + cfg.gap),
    );
    row.add(tile);
  });
  return row;
}
