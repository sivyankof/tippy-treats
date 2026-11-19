import * as Phaser from 'phaser';
import type { Rng } from '../../../core/rng';
import { TOWER_WEATHER } from '../../../data/weather/tower-weather';
import { WEATHER_LOOK, WEATHER_TEX } from '../../../data/weather/weather-look';
import { FIELD_PAD } from '../../../data/common/picture-fields';
import { paddedOrigin } from '../../../util/field-pad';
import { smoothstep } from '../../../util/math';
import { DEPTH } from '../../depth';
import { towerWeatherShown } from './weather-share';
import type { EffectLevel } from '../../../data/app/effect-levels';

const CAP = WEATHER_LOOK.cap;
const SPLASH = WEATHER_LOOK.splash;

/** What the top pieces read of the tower (world space). */
export interface TowerTop {
  /** Number of placed layers. */
  count: number;
  /** World y of the top surface. */
  topY: number;
  left: number;
  right: number;
  /** The run is over: the tower falls, so nothing stays on it. */
  over: boolean;
}

interface Splash {
  image: Phaser.GameObjects.Image;
  bornAt: number;
}

/**
 * The things that sit on the top layer of the tower, in world space just over that layer and under
 * the next one: a thin snow cap that builds up over ~1.6 s whenever a new layer becomes the top, and
 * the rare small splashes of rain. Full and lite show the cap (minimal none); splashes come at full
 * rate on full, half as often on lite, never on minimal.
 */
export class WeatherTop {
  private readonly cap: Phaser.GameObjects.Image | null;
  private readonly splashes: Splash[] = [];
  private lastCount = -1;
  private capAge = 0;
  private nextSplashAt = 0;
  private depth = 0;

  constructor(
    scene: Phaser.Scene,
    snow: boolean,
    rainy: boolean,
    private readonly rng: Rng,
  ) {
    this.cap = snow
      ? scene.add
          .image(0, 0, WEATHER_TEX.cap)
          .setOrigin(
            ...paddedOrigin(
              [0.5, CAP.anchorY / CAP.height],
              CAP.width,
              CAP.height,
              FIELD_PAD.snowCap,
            ),
          )
          .setVisible(false)
      : null;
    if (rainy) {
      for (let i = 0; i < SPLASH.max; i++) {
        const image = scene.add.image(0, 0, WEATHER_TEX.splash).setOrigin(0.5, 1).setVisible(false);
        this.splashes.push({ image, bornAt: -1 });
      }
    }
  }

  /** Depth of the pieces on the top layer: over it, under the next layer. */
  get topDepth(): number {
    return this.depth;
  }

  /**
   * Moves the pieces on; true on the frame a layer has landed on the snow cap of the top layer under it
   * (the cap has grown a little: a layer that lands at once on a fresh one throws no dust).
   */
  update(
    top: TowerTop,
    timeMs: number,
    deltaMs: number,
    level: EffectLevel,
    share: number,
  ): boolean {
    const show = towerWeatherShown(share, top.count, top.over);
    let landed = false;
    if (top.count !== this.lastCount) {
      landed =
        show &&
        this.cap !== null &&
        this.lastCount > 0 &&
        top.count === this.lastCount + 1 &&
        this.capAge >= CAP.growMs * TOWER_WEATHER.dust.minCapShare;
      // The first top builds up at once; a new top starts its cap from nothing.
      this.capAge = this.lastCount < 0 ? CAP.growMs : 0;
      this.lastCount = top.count;
    }
    this.depth = DEPTH.tower + (top.count - 1) * DEPTH.towerLayerStep + CAP.depthStep;
    this.updateCap(top, deltaMs, level, show, share);
    this.updateSplashes(top, timeMs, level, show, share);
    return landed;
  }

  private updateCap(
    top: TowerTop,
    deltaMs: number,
    level: EffectLevel,
    show: boolean,
    share: number,
  ): void {
    const cap = this.cap;
    if (!cap) return;
    this.capAge = Math.min(this.capAge + deltaMs, CAP.growMs);
    const grown = level === 'minimal' ? 0 : smoothstep(this.capAge / CAP.growMs);
    cap.setVisible(show && grown > 0);
    if (!cap.visible) return;
    const width = (top.right - top.left) * CAP.widthShare;
    cap
      .setPosition((top.left + top.right) / 2, top.topY)
      .setDepth(this.depth)
      .setScale(width / CAP.width, grown)
      .setAlpha(share);
  }

  private updateSplashes(
    top: TowerTop,
    timeMs: number,
    level: EffectLevel,
    show: boolean,
    share: number,
  ): void {
    const pause = SPLASH.pauseMs[level];
    if (this.splashes.length === 0) return;
    for (const s of this.splashes) {
      const age = timeMs - s.bornAt;
      if (s.bornAt < 0 || age >= SPLASH.lifeMs || !show) {
        s.bornAt = -1;
        s.image.setVisible(false);
        continue;
      }
      const t = age / SPLASH.lifeMs;
      s.image
        .setDepth(this.depth)
        .setScale(SPLASH.scale * (SPLASH.startScale + (SPLASH.endScale - SPLASH.startScale) * t))
        .setAlpha(SPLASH.alpha * (1 - t) * share);
    }
    if (!show || !pause || timeMs < this.nextSplashAt) return;
    let active = 0;
    for (const s of this.splashes) if (s.bornAt >= 0) active++;
    if (active >= SPLASH.maxShown[level]) return;
    const free = this.splashes.find((s) => s.bornAt < 0);
    this.nextSplashAt = timeMs + this.rng.range(pause[0], pause[1]);
    if (!free) return;
    free.bornAt = timeMs;
    const span = top.right - top.left;
    free.image
      .setPosition(
        top.left + span * this.rng.range(SPLASH.spanShare[0], SPLASH.spanShare[1]),
        top.topY + 2,
      )
      .setVisible(true);
  }
}
