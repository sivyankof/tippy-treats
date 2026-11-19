import * as Phaser from 'phaser';
import type { Rng } from '../../../core/common/rng';
import type { EffectLevel } from '../../../data/app/effect-levels';
import { TOWER_WEATHER } from '../../../data/weather/tower-weather';
import { WEATHER_TEX } from '../../../data/weather/weather-look';
import { DEG_TO_RAD } from '../../../util/math';
import { launchFlake, stepFlake, flakeAlpha, flakeGrow, type DustFlake } from './snow-dust-motion';

const DUST = TOWER_WEATHER.dust;

interface Piece {
  image: Phaser.GameObjects.Image;
  flake: DustFlake;
  live: boolean;
  scale: number;
  spin: number;
}

/**
 * The dust of a landing on a snow cap: a few small flakes fly out in arcs from both ends of the seam, slow
 * down in the air, settle and fade over 0.6-0.9 s (they grow from nothing over the first 80 ms). The pictures
 * are the weather flakes of the shared atlas, drawn in the world just over the layer that landed and under the
 * next one, so nothing shows over the flying layer. Full 7 flakes, lite 3, minimal none.
 */
export class SnowDust {
  private readonly pieces: Piece[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {
    const most = Math.max(...Object.values(DUST.count));
    for (let i = 0; i < most; i++) {
      const image = scene.add
        .image(0, 0, WEATHER_TEX.flake[DUST.pictures[0] ?? 0] ?? '')
        .setVisible(false);
      this.pieces.push({
        image,
        flake: { x: 0, y: 0, vx: 0, vy: 0, ageMs: 0, lifeMs: 1 },
        live: false,
        scale: 1,
        spin: 0,
      });
    }
  }

  /** Throws the dust from the seam: both ends `y` high, at `left` and `right`, over depth `depth`. */
  burst(left: number, right: number, y: number, depth: number, level: EffectLevel): void {
    const count = DUST.count[level];
    if (count <= 0) return;
    let side: -1 | 1 = -1;
    let used = 0;
    for (const piece of this.pieces) {
      if (used >= count) break;
      if (piece.live) continue;
      used++;
      const flake = piece.flake;
      launchFlake(
        flake,
        side < 0 ? left : right,
        y,
        side,
        this.rng.range(DUST.angleDeg[0], DUST.angleDeg[1]),
        this.rng.range(DUST.speedPx[0], DUST.speedPx[1]),
        this.rng.range(DUST.lifeMs[0], DUST.lifeMs[1]),
      );
      piece.scale = this.rng.range(DUST.scale[0], DUST.scale[1]);
      piece.spin = side * this.rng.range(DUST.spinShare[0], DUST.spinShare[1]) * DUST.spinDeg;
      const picture = DUST.pictures[this.rng.int(0, DUST.pictures.length - 1)] ?? 0;
      piece.image
        .setTexture(WEATHER_TEX.flake[picture] ?? '')
        .setDepth(depth)
        .setScale(0)
        .setAngle(this.rng.range(0, 360))
        .setVisible(true);
      piece.live = true;
      side = side < 0 ? 1 : -1;
    }
  }

  update(deltaMs: number, share: number): void {
    for (const piece of this.pieces) {
      if (!piece.live) continue;
      const flake = piece.flake;
      stepFlake(flake, deltaMs);
      if (flake.ageMs >= flake.lifeMs) {
        piece.live = false;
        piece.image.setVisible(false);
        continue;
      }
      piece.image
        .setPosition(flake.x, flake.y)
        .setScale(piece.scale * flakeGrow(flake.ageMs))
        .setAlpha(flakeAlpha(flake.ageMs, flake.lifeMs) * share)
        .setRotation(piece.image.rotation + piece.spin * DEG_TO_RAD * (deltaMs / 1000));
    }
  }

  /** Stops all the flakes at once (the tower fell). */
  clear(): void {
    for (const piece of this.pieces) {
      piece.live = false;
      piece.image.setVisible(false);
    }
  }
}
