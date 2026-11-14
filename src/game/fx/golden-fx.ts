import type * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { TREASURE } from '../../data/treasure-anim';
import { oscillate01, TWO_PI } from '../../util/math';
import { effectsMode } from '../effects-mode';
import type { FlyingLayerView } from '../objects/flying-layer-view';
import type { TowerView } from '../objects/tower-view';
import type { Point } from './coin-flight-math';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import { FX_TEXTURES } from './fx-textures';
import { coneBurst } from './particle-motion';
import type { Particles } from './particles';

const cfg = TREASURE.golden;
const HALF_LAYER = BALANCE.layer.height / 2;
/** Directions of a particle cone (degrees, 0 is right): behind a layer that flies right or left. */
const LEFT_DEG = 180;
const RIGHT_DEG = 0;

/**
 * The shine of a golden layer: a gloss band that keeps running over it, sparkles that circle
 * it and a golden trail behind it in flight. Everything stays off while a cloud hides the layer.
 */
export class GoldenFx {
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private trailMs = 0;
  private glossMs: number = cfg.glossEveryMs * cfg.glossFirstShare;
  private towerGlossMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly flying: FlyingLayerView,
    private readonly particles: Particles,
  ) {
    for (let i = 0; i < cfg.sparkles.count; i++) {
      this.stars.push(
        scene.add
          .image(0, 0, FX_TEXTURES.star)
          .setTint(TREASURE.colors.sparkle[i % TREASURE.colors.sparkle.length])
          .setDepth(FLYING_FX_DEPTH.sparkles)
          .setVisible(false),
      );
    }
  }

  /**
   * `pos` is the centre of the flying layer, `hidden` is true while a cloud covers it. The
   * golden layers that stand in the tower shine too.
   */
  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    pos: Readonly<Point> | null,
    hidden: boolean,
  ): void {
    const layer = state.flying;
    const shine = layer?.kind === 'golden' && pos && !hidden ? pos : null;
    this.placeSparkles(timeMs, shine, layer?.width ?? 0);
    if (shine && layer) {
      this.runGloss(dtMs);
      if (state.phase === 'flying') this.runTrail(dtMs, shine, layer.width, layer.dir);
    } else {
      this.glossMs = cfg.glossEveryMs * cfg.glossFirstShare;
    }
    this.runTowerGloss(dtMs);
  }

  /** The gloss band of the flying layer comes round again and again. */
  private runGloss(dtMs: number): void {
    this.glossMs += dtMs;
    if (this.glossMs < cfg.glossEveryMs) return;
    this.glossMs -= cfg.glossEveryMs;
    this.flying.sweepGloss();
  }

  private runTowerGloss(dtMs: number): void {
    this.towerGlossMs += dtMs;
    if (this.towerGlossMs < cfg.towerGlossEveryMs) return;
    this.towerGlossMs -= cfg.towerGlossEveryMs;
    for (const [, view] of this.tower.views()) {
      if (view.look.kind === 'golden') view.playGlossSweep();
    }
  }

  /** Gold stars shed from the back edge of the flying layer. */
  private runTrail(dtMs: number, pos: Readonly<Point>, width: number, dir: 1 | -1): void {
    this.trailMs += dtMs;
    const every = cfg.trail.everyMs * (effectsMode.reduced ? 2 : 1);
    if (this.trailMs < every) return;
    this.trailMs -= every;
    const x = pos.x - (dir * width) / 2;
    const y = pos.y + (Math.random() - 0.5) * BALANCE.layer.height;
    const heading = dir === 1 ? LEFT_DEG : RIGHT_DEG;
    this.particles.emit(1, (n) => coneBurst(x, y, heading, n, cfg.trail.style), {
      texture: FX_TEXTURES.star,
      tints: TREASURE.colors.sparkle,
      depth: FLYING_FX_DEPTH.behind,
    });
  }

  /** The sparkles circle the layer, each one twinkling on its own beat. */
  private placeSparkles(timeMs: number, pos: Readonly<Point> | null, width: number): void {
    const {
      count,
      scale,
      alpha,
      orbitPeriodMs,
      twinklePeriodMs,
      twinklePhaseStep,
      spinDeg,
      padX,
      padY,
    } = cfg.sparkles;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (!star) continue;
      star.setVisible(pos !== null);
      if (!pos) continue;
      const angle = TWO_PI * (timeMs / orbitPeriodMs) + (TWO_PI * i) / count;
      const twinkle = oscillate01(timeMs, twinklePeriodMs, i * twinklePhaseStep);
      star
        .setPosition(
          pos.x + Math.cos(angle) * (width / 2 + padX),
          pos.y + Math.sin(angle) * (HALF_LAYER + padY),
        )
        .setScale(scale[0] + (scale[1] - scale[0]) * twinkle)
        .setAlpha(alpha[0] + (alpha[1] - alpha[0]) * twinkle)
        .setAngle(twinkle * spinDeg);
    }
  }
}
