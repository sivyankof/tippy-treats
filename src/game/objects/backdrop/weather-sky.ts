import * as Phaser from 'phaser';
import { Rng } from '../../../core/rng';
import type { WeatherId } from '../../../data/weather';
import { WEATHER_LOOK, WEATHER_TEX, type WeatherZone } from '../../../data/weather-look';
import type { ZoneId } from '../../../data/zones';
import { TWO_PI } from '../../../util/math';
import { effectsMode } from '../../effects-mode';
import { flightClearBand, hudFloor, hudKeepOutFade } from '../../camera-layout';
import type { FrameCtx, Life } from './life';
import { bankKey } from './weather-art';
import { bankEdge, flashEnvelope, nextBoltAt } from './weather-motion';

const BANK = WEATHER_LOOK.bank;
const BOLT = WEATHER_LOOK.lightning;
const BANK_FLASH = {
  widthPx: BANK.flashWidthPx,
  heightShare: BANK.flashHeightShare,
  centreShare: BANK.flashCentreShare,
};
const NIGHT = WEATHER_LOOK.night;

/** Cloud banks of storms that are alive, so the debug hook can strike them. */
const BANKS = new Set<WeatherBank>();

/** Debug: every live storm bank strikes right away. */
export function strikeLightningNow(): void {
  for (const bank of BANKS) {
    if (bank.alive) bank.strikeNow();
    else BANKS.delete(bank);
  }
}

/**
 * The cloud bank of rain and storm: one opaque figure that is part of the zone's sky, behind the
 * houses. It drifts slowly on full and lite and stands still on minimal. A storm adds lightning, a
 * pale twin of the bank and a jagged bolt that stays inside the cloud, in a flash of 120-180 ms
 * every 8-15 s (full and lite; minimal none).
 */
export class WeatherBank implements Life {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly bank: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image | null = null;
  private readonly bolt: Phaser.GameObjects.Image | null = null;
  private nextAt: number;
  private flashAt = -1;
  private flashMs = 0;
  /** Where the strike stands (screen px) and whether it has a bolt (it may find no free place). */
  private strike: { x: number; y: number; scale: number; edge: number } | null = null;
  private pending = false;

  constructor(
    scene: Phaser.Scene,
    zone: WeatherZone,
    weather: WeatherId,
    private readonly rng: Rng,
  ) {
    this.bank = new Phaser.GameObjects.Image(scene, 0, 0, bankKey(zone, weather))
      .setOrigin(0.5, 0)
      .setScale(BANK.scale);
    this.objects = [this.bank];
    if (weather === 'storm') {
      this.flash = new Phaser.GameObjects.Image(
        scene,
        0,
        0,
        bankKey(zone, weather, true),
      ).setVisible(false);
      this.bolt = new Phaser.GameObjects.Image(scene, 0, 0, WEATHER_TEX.bolt)
        .setOrigin(0.5, 0)
        .setVisible(false);
      this.objects.push(this.flash, this.bolt);
      BANKS.add(this);
    }
    this.nextAt = nextBoltAt(0, BOLT.firstMs, rng.next());
  }

  get alive(): boolean {
    return this.bank.scene !== undefined;
  }

  /** Debug: the next bolt strikes at the next frame. */
  strikeNow(): void {
    this.pending = true;
  }

  update(ctx: FrameCtx): void {
    const still = effectsMode.level === 'minimal';
    const drift = still ? 0 : BANK.driftPx * Math.sin((TWO_PI * ctx.timeMs) / BANK.driftMs);
    const x = ctx.width / 2 + drift;
    this.bank.setPosition(x, 0);
    if (this.flash && this.bolt) this.updateStrike(ctx, x, still);
  }

  private updateStrike(ctx: FrameCtx, bankX: number, still: boolean): void {
    const { flash, bolt } = this;
    if (!flash || !bolt) return;
    if (still) {
      flash.setVisible(false);
      bolt.setVisible(false);
      return;
    }
    const now = ctx.timeMs;
    if (this.flashAt < 0 && (this.pending || now >= this.nextAt)) {
      this.pending = false;
      this.flashAt = now;
      this.flashMs = this.rng.range(BOLT.flashMs[0], BOLT.flashMs[1]);
      this.strike = this.pickStrike(ctx, bankX);
      this.nextAt = nextBoltAt(now, BOLT.everyMs, this.rng.next());
    }
    const strength = this.flashAt < 0 ? 0 : flashEnvelope(now - this.flashAt, this.flashMs);
    if (this.flashAt >= 0 && now - this.flashAt >= this.flashMs) this.flashAt = -1;
    const strike = this.strike;
    const on = strength > 0 && strike !== null;
    flash.setVisible(on);
    bolt.setVisible(on);
    if (!on) return;
    // Only a patch of the cloud around the bolt lights up, inside the cloud.
    flash
      .setPosition(strike.x, strike.edge * BANK_FLASH.centreShare)
      .setDisplaySize(BANK_FLASH.widthPx, strike.edge * BANK_FLASH.heightShare)
      .setAlpha(BOLT.flashAlpha * strength);
    bolt.setPosition(strike.x, strike.y).setScale(strike.scale).setAlpha(1);
  }

  /**
   * A place for the bolt inside the cloud: it starts a little way down from the top, is at most 0.6
   * of the cloud's height there, ends at least 25 px above the cloud's lower edge, and clears every
   * HUD plate by the HUD gap. `null` when the draws find none (the flash plays without a bolt).
   */
  private pickStrike(
    ctx: FrameCtx,
    bankX: number,
  ): { x: number; y: number; scale: number; edge: number } | null {
    for (let i = 0; i < BOLT.tries; i++) {
      const range = BOLT.xRanges[this.rng.int(0, BOLT.xRanges.length - 1)];
      if (!range) return null;
      const x = ctx.width * this.rng.range(range[0], range[1]);
      const edge = bankEdge((x - bankX) / BANK.scale + BANK.width / 2) * BANK.scale;
      if (edge < BOLT.minCloudPx) continue;
      const top = edge * BOLT.topShare;
      const end = Math.min(top + edge * BOLT.lengthShare, edge - BOLT.endGapPx);
      if (end - top < BOLT.height * 0.25) continue;
      const clear = [top, (top + end) / 2, end].every((y) => hudKeepOutFade(x, y) > 0);
      if (clear) return { x, y: top, scale: (end - top) / BOLT.height, edge };
    }
    return null;
  }
}

interface Star {
  image: Phaser.GameObjects.Image;
  /** Candidate places as shares of the screen; the first that clears the HUD and the flight row is used. */
  spots: Array<[number, number]>;
  alpha: number;
  periodMs: number;
  phase: number;
}

/**
 * The night sky: small flat stars (they twinkle in scale and alpha on full, stand still on lite and
 * minimal) and the crescent moon, both in the zone's sky behind the houses. A star is never shown
 * inside the HUD plates plus the HUD gap or in the flight row; the moon hangs at the HUD floor on
 * the left and is left out when there is no room above the row.
 */
export class WeatherNight implements Life {
  readonly objects: Phaser.GameObjects.Image[] = [];
  private readonly stars: Star[] = [];
  private readonly moon: Phaser.GameObjects.Image;
  private laidOutFor = '';

  constructor(scene: Phaser.Scene, rng: Rng) {
    for (let i = 0; i < NIGHT.stars; i++) {
      const frames = WEATHER_TEX.star;
      const image = new Phaser.GameObjects.Image(scene, 0, 0, frames[i % frames.length] ?? '');
      this.stars.push({
        image,
        spots: Array.from({ length: NIGHT.tries }, () => [rng.next(), rng.next()]),
        alpha: rng.range(NIGHT.starAlpha[0], NIGHT.starAlpha[1]),
        periodMs: rng.range(NIGHT.twinkleMs[0], NIGHT.twinkleMs[1]),
        phase: rng.next() * TWO_PI,
      });
      this.objects.push(image);
    }
    this.moon = new Phaser.GameObjects.Image(scene, 0, 0, WEATHER_TEX.moon);
    this.objects.push(this.moon);
  }

  private layout(width: number, height: number): void {
    const key = `${width}x${height}`;
    if (key === this.laidOutFor) return;
    this.laidOutFor = key;
    const band = flightClearBand(height);
    const lowest = band.top - NIGHT.aboveBandPx;
    const radius = NIGHT.moon.radius;
    const moonX = width * NIGHT.moon.xShare;
    const moonY = hudFloor() + radius;
    const moonFits = moonY + radius < lowest && hudKeepOutFade(moonX, moonY, radius) > 0;
    this.moon.setPosition(moonX, moonY).setVisible(moonFits);
    for (const star of this.stars) {
      star.image.setVisible(false);
      for (const [u, v] of star.spots) {
        const x = u * width;
        const y = NIGHT.topMarginPx + v * Math.max(lowest - NIGHT.topMarginPx, 0);
        if (hudKeepOutFade(x, y, star.image.width / 2) > 0) {
          star.image.setPosition(x, y).setVisible(true);
          break;
        }
      }
    }
  }

  update(ctx: FrameCtx): void {
    this.layout(ctx.width, ctx.height);
    const twinkle = effectsMode.level === 'full';
    for (const s of this.stars) {
      if (!s.image.visible) continue;
      const wave = twinkle ? Math.sin((TWO_PI * ctx.timeMs) / s.periodMs + s.phase) : 0;
      const alpha = s.alpha * (1 - NIGHT.twinkleDepth * (0.5 + 0.5 * wave));
      s.image.setAlpha(alpha).setScale(1 + NIGHT.twinkleScale * wave);
    }
  }
}

/** The weather pieces that belong to a zone's sky; they sit right after the sky picture. */
export function weatherSkyLives(scene: Phaser.Scene, zone: ZoneId, weather: WeatherId): Life[] {
  if (zone !== 'roof' && zone !== 'clouds') return [];
  const rng = new Rng(WEATHER_LOOK.skySeed).fork(`${weather}_sky`);
  if (weather === 'rain' || weather === 'storm')
    return [new WeatherBank(scene, zone, weather, rng)];
  if (weather === 'night') return [new WeatherNight(scene, rng)];
  return [];
}
