import * as Phaser from 'phaser';
import { ANIM } from '../../../../data/common/anim';
import { BALANCE } from '../../../../data/tower/balance';
import { SHARE_CARD } from '../../../../data/run/share';
import { t } from '../../../../i18n';
import { mixColor } from '../../../../util/color';
import { LayerView } from '../../../objects/tower/layer-view';
import type { TowerSnapshot } from '../../../objects/tower/tower-snapshot';
import { offList } from '../../common/bake-texture';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import { fitTower } from './share-card-layout';

const cfg = SHARE_CARD;
const CARD_KEY = 'share_card';

function fillSky(card: Phaser.Textures.DynamicTexture): void {
  const bandHeight = cfg.height / cfg.skyBands;
  for (let i = 0; i < cfg.skyBands; i++) {
    const color = mixColor(cfg.skyTop, cfg.skyBottom, i / (cfg.skyBands - 1));
    // One extra pixel per band hides the seam between bands.
    card.fill(color, 1, 0, Math.floor(i * bandHeight), cfg.width, Math.ceil(bandHeight) + 1);
  }
}

/** The worktop under the tray: its light edge, then the body down to the bottom of the picture. */
function fillCounter(card: Phaser.Textures.DynamicTexture, top: number): void {
  card.fill(cfg.counterTop, 1, 0, top, cfg.width, cfg.counterTopHeight);
  const bodyTop = top + cfg.counterTopHeight;
  card.fill(cfg.counter, 1, 0, bodyTop, cfg.width, cfg.height - bodyTop);
}

function drawTray(
  scene: Phaser.Scene,
  card: Phaser.Textures.DynamicTexture,
  scale: number,
  trayY: number,
): void {
  const { fill, shadow, radius } = cfg.tray;
  const width = BALANCE.tray.width * scale;
  const thickness = ANIM.tray.thickness * scale;
  const g = offList(new Phaser.GameObjects.Graphics(scene));
  const left = (cfg.width - width) / 2;
  g.fillStyle(shadow, 1);
  g.fillRoundedRect(left, trayY, width, thickness, radius * scale);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(left, trayY, width, thickness * cfg.tray.faceShare, radius * scale);
  card.draw(g, 0, 0).render();
  g.destroy();
}

function drawText(
  scene: Phaser.Scene,
  card: Phaser.Textures.DynamicTexture,
  line: { y: number; font: number; color: number },
  text: string,
): void {
  const label = offList(
    createOutlinedText(scene, cfg.width / 2, line.y, text, line.font, line.color),
  );
  fitText(label, cfg.width - cfg.tower.sideMargin * 2);
  card.draw(label).render();
  label.destroy();
}

/**
 * Draws every layer, bottom to top, with one temporary view. A draw command reads the view when
 * the texture renders, so the texture renders after each layer (docs/08, journal 2026-11-15).
 */
function drawLayers(
  scene: Phaser.Scene,
  card: Phaser.Textures.DynamicTexture,
  tower: TowerSnapshot,
  scale: number,
  centerX: number,
  trayY: number,
): void {
  const view = offList(new LayerView(scene).setStageMode('level'));
  try {
    tower.layers.forEach((layer, i) => {
      view
        .resetAnim()
        // `resetAnim` puts the scale back to 1.
        .setScale(scale)
        .setLook(layer)
        .setLayer(i + 1, layer.width, tower.cuts[i] ?? null);
      const x = cfg.width / 2 + (layer.x - centerX) * scale;
      const y = trayY - (i + 0.5) * BALANCE.layer.height * scale;
      card.draw(view, x, y).render();
    });
  } finally {
    view.destroy();
  }
}

/** Reads the picture of the texture as a PNG file. */
function snapshotBlob(card: Phaser.Textures.DynamicTexture): Promise<Blob> {
  return new Promise((resolve, reject) => {
    card.snapshot((image) => {
      if (!(image instanceof HTMLImageElement)) {
        reject(new Error('share card: no image'));
        return;
      }
      fetch(image.src)
        .then((response) => response.blob())
        .then(resolve, reject);
    }, cfg.mimeType);
  });
}

/**
 * The picture "Share" hands out: the whole tower scaled down on a kitchen card, with the game
 * name and the height. It is made from the plain data of the run, not from the live views.
 */
export async function renderShareCard(
  scene: Phaser.Scene,
  tower: TowerSnapshot,
  height: number,
): Promise<Blob> {
  const card = scene.textures.addDynamicTexture(CARD_KEY, cfg.width, cfg.height);
  if (!card) throw new Error('share card: no texture');
  try {
    const { scale, centerX, trayY } = fitTower(tower.layers, {
      width: cfg.width - cfg.tower.sideMargin * 2,
      height: cfg.tower.trayY - cfg.tower.top,
      maxScale: cfg.maxScale,
      bottom: cfg.tower.trayY,
    });
    fillSky(card);
    card.render();
    fillCounter(card, trayY + ANIM.tray.thickness * scale * cfg.counterOverlapShare);
    card.render();
    drawTray(scene, card, scale, trayY);
    drawLayers(scene, card, tower, scale, centerX, trayY);
    drawText(scene, card, cfg.title, t('share.title'));
    drawText(scene, card, cfg.heightLine, t('share.height', { n: height }));
    return await snapshotBlob(card);
  } finally {
    scene.textures.remove(CARD_KEY);
  }
}
