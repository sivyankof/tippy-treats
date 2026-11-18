import * as Phaser from 'phaser';
import { Rng } from '../../../core/rng';
import { PANORAMA, WALL_LOOK } from '../../../data/window-look';
import { WEATHER_LOOK } from '../../../data/weather-look';
import { effectsMode } from '../../effects-mode';
import { fxGuard } from '../../fx-guard';
import type { FrameCtx, Life } from './life';
import { onLayer } from './layer-anchor';
import type { LayerSpot } from './layer-life';
import { flashEnvelope, nextBoltAt } from './weather-motion';

const BOLT = WEATHER_LOOK.lightning;
const G = PANORAMA.glass;

/** Flashes that are alive; filled in development only, for the debug hook. */
const FLASHES = new Set<PanoramaFlash>();

/** Debug: every storm flash in a panoramic window shows right away; how many there are. */
export function strikeWindowFlashNow(): number {
  for (const flash of FLASHES) flash.strikeNow();
  return FLASHES.size;
}

/**
 * The flash of a storm in the glass of the panoramic window: the glass-shaped patch lights up for 120-180 ms
 * (a quick rise, a longer fall), every 8-15 s, on its own beat. It rides with the window and is skipped on the
 * minimal level (the sky and the frame only). A failure here skips the flash, not the frame (`fxGuard`).
 */
export class PanoramaFlash implements Life {
  readonly anchor = onLayer(WALL_LOOK.layer);
  readonly objects: Phaser.GameObjects.Image[];
  private readonly image: Phaser.GameObjects.Image;
  private nextAt = -1;
  private flashAt = -1;
  private flashMs = 0;
  private pending = false;
  private readonly firstU: number;

  constructor(
    scene: Phaser.Scene,
    texture: string,
    private readonly spot: LayerSpot,
    private readonly rng: Rng = new Rng(WEATHER_LOOK.skySeed).fork('window_flash'),
  ) {
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, texture).setVisible(false);
    this.objects = [this.image];
    this.firstU = this.rng.next();
    if (import.meta.env.DEV) {
      FLASHES.add(this);
      this.image.once(Phaser.GameObjects.Events.DESTROY, () => FLASHES.delete(this));
    }
  }

  strikeNow(): void {
    this.pending = true;
  }

  update(ctx: FrameCtx): void {
    if (!fxGuard.call('window-flash', this, this.step, ctx)) {
      fxGuard.cleanup('window-flash', this, this.hide);
    }
  }

  private hide(): void {
    this.image.setVisible(false);
  }

  private step(ctx: FrameCtx): void {
    const spot = this.spot;
    if (effectsMode.reduced || spot.alpha <= 0) {
      this.flashAt = -1;
      this.image.setVisible(false);
      return;
    }
    const now = ctx.timeMs;
    if (this.nextAt < 0) this.nextAt = nextBoltAt(now, BOLT.firstMs, this.firstU);
    if (this.flashAt < 0 && (this.pending || now >= this.nextAt)) {
      this.pending = false;
      this.flashAt = now;
      this.flashMs = this.rng.range(BOLT.flashMs[0], BOLT.flashMs[1]);
      this.nextAt = nextBoltAt(now, BOLT.everyMs, this.rng.next());
    }
    const strength = this.flashAt < 0 ? 0 : flashEnvelope(now - this.flashAt, this.flashMs);
    if (this.flashAt >= 0 && now - this.flashAt >= this.flashMs) this.flashAt = -1;
    this.image.setVisible(strength > 0);
    if (strength <= 0) return;
    const scale = spot.scale / PANORAMA.flash.bakeShare;
    this.image
      .setPosition(
        spot.x + (G.x + G.w / 2 - PANORAMA.width / 2) * spot.scale,
        spot.y + (G.y + G.h / 2 - PANORAMA.height / 2) * spot.scale,
      )
      .setScale(scale)
      .setAlpha(PANORAMA.flash.alpha * strength * spot.alpha);
  }
}
