import * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { BD_TEX, COUNTER } from '../../../data/backdrop';
import { BACKDROP_COLORS } from '../../../data/backdrop-colors';
import { KITCHEN_COLORS } from '../../../data/palette';
import { oscillate01, sineWave } from '../../../util/math';
import { shade } from '../../../util/color';
import { DEPTH } from '../../depth';
import { bakeTexture } from '../../ui/bake-texture';
import { bakeSharedArt } from './art-kit';
import { PuffColumn } from './life';

const K = BD_TEX.kitchen;
const C = BACKDROP_COLORS.kitchen;
const MUG = COUNTER.mug;
const { sheenHeight: SHEEN_HEIGHT, sheenLayers: SHEEN_LAYERS } = COUNTER;

function bakeCounterArt(scene: Phaser.Scene): void {
  bakeSharedArt(scene);
  bakeTexture(scene, K.mug, MUG.width, MUG.height, (g) => {
    g.lineStyle(9, shade(C.mug, -0.25), 1);
    g.strokeCircle(72, 60, 16);
    g.fillStyle(shade(C.mug, -0.25), 1);
    g.fillRoundedRect(6, 22, 68, 76, 16);
    g.fillStyle(C.mug, 1);
    g.fillRoundedRect(8, 22, 62, 70, 14);
    g.fillStyle(C.coffee, 1);
    g.fillEllipse(39, 28, 58, 14);
    g.fillStyle(BACKDROP_COLORS.shared.white, 0.4);
    g.fillRoundedRect(16, 44, 8, 34, 4);
  });
  bakeTexture(scene, K.sheen, COUNTER.sheen.width, SHEEN_HEIGHT, (g) => {
    g.fillStyle(C.sheen, 1 / SHEEN_LAYERS);
    for (let i = 0; i < SHEEN_LAYERS; i++) {
      const k = 1 - i / SHEEN_LAYERS;
      g.fillEllipse(
        COUNTER.sheen.width / 2,
        SHEEN_HEIGHT / 2,
        COUNTER.sheen.width * k,
        (SHEEN_HEIGHT - 4) * k,
      );
    }
  });
}

/**
 * The worktop under the tray. It is part of the world (it scrolls away with the tray)
 * and stays in every zone; a sheen runs along it and a mug of tea steams on it.
 */
export class Counter {
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly mug: Phaser.GameObjects.Image;
  private readonly steam: PuffColumn;
  private readonly top: number;

  constructor(
    scene: Phaser.Scene,
    trayTopY: number,
    private readonly width: number,
  ) {
    bakeCounterArt(scene);
    const depth = DEPTH.counter;
    this.top = trayTopY + ANIM.tray.thickness;
    this.body = scene.add.graphics().setDepth(depth);
    this.body.fillStyle(KITCHEN_COLORS.counter, 1);
    this.body.fillRect(0, this.top, width, COUNTER.bodyDepth);
    this.body.fillStyle(KITCHEN_COLORS.counterTop, 1);
    this.body.fillRect(0, this.top, width, COUNTER.topHeight);
    this.body.fillStyle(shade(KITCHEN_COLORS.counter, -0.2), 1);
    this.body.fillRect(0, this.top + COUNTER.topHeight, width, COUNTER.edgeHeight);

    this.sheen = scene.add
      .image(0, this.top + COUNTER.topHeight / 2, K.sheen)
      .setDepth(depth + 0.01)
      .setAlpha(0);
    this.mug = scene.add
      .image(COUNTER.mug.x, this.top + COUNTER.mug.sink, K.mug)
      .setOrigin(0.5, 1)
      .setDepth(depth + 0.02);
    this.steam = new PuffColumn(scene, COUNTER.mug.steam);
    for (const puff of this.steam.objects) scene.add.existing(puff).setDepth(depth + 0.03);
  }

  update(timeMs: number): void {
    const { breathe, sheen, mug } = COUNTER;
    this.body.setAlpha(
      breathe.lo + (breathe.hi - breathe.lo) * oscillate01(timeMs, breathe.periodMs),
    );
    this.mug.setScale(1 + mug.pulse.amount * sineWave(timeMs, mug.pulse.ms));
    this.steam.updateAt(timeMs, mug.x, this.top + mug.sink - MUG.height / 2 + mug.steamOffsetY);

    // The sheen crosses the worktop, then rests out of sight for the rest of its period.
    const lap = (timeMs % sheen.periodMs) / sheen.periodMs;
    const travel = Math.min(1, lap / (1 - sheen.restShare));
    this.sheen.setX(-sheen.width / 2 + travel * (this.width + sheen.width));
    this.sheen.setAlpha(lap < 1 - sheen.restShare ? sheen.alpha * Math.sin(Math.PI * travel) : 0);
  }
}
