import type * as Phaser from 'phaser';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { clamp01, sineWave, smoothstep } from '../../util/math';
import { scatter } from '../objects/creature-art/primitives';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import { createTreasureTextures, TREASURE_TEXTURES } from './treasure-textures';

const cfg = RULE_ANIM.cloud;

/** The bank spans the whole screen plus the padding: the flying layer is always inside it. */
const BANK_SPAN = LOGICAL_SIZE.width + cfg.pad * 2;
const PUFF_COUNT = Math.min(cfg.maxPuffs, Math.ceil(BANK_SPAN / cfg.spacing) + 1);
const PUFF_STEP = BANK_SPAN / (PUFF_COUNT - 1);
/** The linear drift stops here, so that the sway on top of it never opens a gap at a screen edge. */
const DRIFT_LIMIT = cfg.pad - cfg.driftPx;
const MS_PER_S = 1000;

/** How far the cloud is in (0 gone, 1 over the layer) after `dtMs`, covering or leaving. */
export function stepCover(cover: number, covering: boolean, fast: boolean, dtMs: number): number {
  const spanMs = covering ? cfg.inMs : fast ? cfg.dropOutMs : cfg.outMs;
  return clamp01(cover + ((covering ? 1 : -1) * dtMs) / spanMs);
}

/** Opacity of the bank: solid from the first covered frame, it fades only while it leaves. */
export function coverAlpha(cover: number, covering: boolean): number {
  return covering ? 1 : smoothstep(cover);
}

/** How far a leaving bank has risen (0 while covering, up to `slidePx` once gone). */
export function coverRise(cover: number, covering: boolean): number {
  return covering ? 0 : (1 - smoothstep(cover)) * cfg.slidePx;
}

/** Size of the puffs as a share of full size: they swell a little while the cloud arrives. */
export function coverSwell(cover: number): number {
  return cfg.enterScale + (1 - cfg.enterScale) * smoothstep(cover);
}

/**
 * A bank of cloud puffs side by side across the whole flying row that hides the layer, then
 * drifts on. It is fixed in the world while it hangs there: it does not follow the layer, so
 * the player cannot aim by it. It is drawn over the layer, its coats and everything around it.
 */
export class CloudCover {
  private readonly puffs: Phaser.GameObjects.Image[] = [];
  private cover = 0;
  /** Which way the bank drifts, and how far it has got since the cloud came. */
  private dir: 1 | -1 = 1;
  private driftX = 0;

  constructor(scene: Phaser.Scene) {
    createTreasureTextures(scene);
    for (let i = 0; i < PUFF_COUNT; i++) {
      this.puffs.push(
        scene.add
          .image(0, 0, TREASURE_TEXTURES.cloud)
          .setDepth(FLYING_FX_DEPTH.cloud)
          .setVisible(false),
      );
    }
  }

  /** How far the cloud is over the layer, 0..1. */
  get amount(): number {
    return this.cover;
  }

  /**
   * `covering` while the sim says a cloud hangs over the layer; `fast` makes the cloud leave
   * quickly (the layer was dropped). `y` is the height of the flying row and `dir` the way the
   * layer flies when the cloud arrives: the bank drifts that way. Its x is not tied to the layer.
   */
  update(
    dtMs: number,
    timeMs: number,
    covering: boolean,
    fast: boolean,
    y: number,
    dir: 1 | -1,
  ): void {
    if (covering && this.cover <= 0) {
      this.dir = dir;
      this.driftX = 0;
    }
    this.cover = stepCover(this.cover, covering, fast, dtMs);
    const shown = this.cover > 0;
    if (shown) {
      const next = this.driftX + (this.dir * cfg.driftSpeed * dtMs) / MS_PER_S;
      this.driftX = Math.max(-DRIFT_LIMIT, Math.min(DRIFT_LIMIT, next));
    }
    const alpha = coverAlpha(this.cover, covering);
    const rise = coverRise(this.cover, covering);
    const swell = coverSwell(this.cover);
    const sway = sineWave(timeMs, cfg.driftPeriodMs) * cfg.driftPx;
    const [minScale, maxScale] = cfg.scale;
    for (let i = 0; i < this.puffs.length; i++) {
      const puff = this.puffs[i];
      if (!puff) continue;
      puff.setVisible(shown);
      if (!shown) continue;
      const bob = sineWave(timeMs, cfg.bobPeriodMs, i * cfg.bobPhaseStep) * cfg.bobPx;
      puff
        .setPosition(-cfg.pad + PUFF_STEP * i + this.driftX + sway, y + bob - rise)
        .setScale((minScale + (maxScale - minScale) * scatter(i)) * swell)
        .setAlpha(alpha);
    }
  }
}
