import * as Phaser from 'phaser';
import type { Rng } from '../../../core/rng';
import { WEATHER_LOOK, WEATHER_TEX } from '../../../data/weather-look';
import { TWO_PI } from '../../../util/math';
import { flashEnvelope, nextBoltAt, particleFade } from './weather-motion';
import type { WeatherFrame, WeatherPart } from './weather-frame';

const BANK = WEATHER_LOOK.bank;
const BOLT = WEATHER_LOOK.lightning;
const NIGHT = WEATHER_LOOK.night;

/**
 * The cloud bank of rain and storm, part of the sky: a wide soft picture along the top edge with a
 * wavy lower edge. It drifts slowly (full and lite) and stands still on minimal. A storm adds
 * lightning: a pale overlay of the same bank and a jagged bolt inside it for 120-180 ms, no more
 * than once per 8-15 s; lite plays it too, minimal never.
 */
export class WeatherBank implements WeatherPart {
  readonly objects: Phaser.GameObjects.Image[];
  private readonly bank: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image | null;
  private readonly bolt: Phaser.GameObjects.Image | null;
  private nextAt: number;
  private flashAt = -1;
  private flashMs = 0;
  private boltX = 0;

  constructor(
    scene: Phaser.Scene,
    storm: boolean,
    private readonly rng: Rng,
  ) {
    this.bank = new Phaser.GameObjects.Image(
      scene,
      0,
      0,
      storm ? WEATHER_TEX.bankStorm : WEATHER_TEX.bankRain,
    )
      .setOrigin(0.5, 0)
      .setScale(BANK.scale);
    this.flash = storm
      ? new Phaser.GameObjects.Image(scene, 0, 0, WEATHER_TEX.bankFlash)
          .setOrigin(0.5, 0)
          .setScale(BANK.scale)
          .setVisible(false)
      : null;
    this.bolt = storm
      ? new Phaser.GameObjects.Image(scene, 0, 0, WEATHER_TEX.bolt)
          .setOrigin(0.5, 0)
          .setVisible(false)
      : null;
    this.objects = [this.bank];
    if (this.flash) this.objects.push(this.flash);
    if (this.bolt) this.objects.push(this.bolt);
    this.nextAt = nextBoltAt(0, BOLT.firstMs, rng.next());
  }

  /** Debug: the next bolt strikes right away. */
  strikeNow(timeMs: number): void {
    this.nextAt = timeMs;
  }

  layout(frame: WeatherFrame): void {
    this.bank.setPosition(frame.width / 2, 0);
  }

  update(frame: WeatherFrame): void {
    const visible = frame.share > 0;
    this.bank.setVisible(visible);
    if (!visible) {
      this.flash?.setVisible(false);
      this.bolt?.setVisible(false);
      return;
    }
    const still = frame.level === 'minimal';
    const drift = still ? 0 : BANK.driftPx * Math.sin((TWO_PI * frame.timeMs) / BANK.driftMs);
    const x = frame.width / 2 + drift;
    this.bank.setPosition(x, 0).setAlpha(BANK.alpha * frame.share);
    if (!this.flash || !this.bolt) return;
    this.updateBolt(frame, x, still);
  }

  private updateBolt(frame: WeatherFrame, bankX: number, still: boolean): void {
    const { flash, bolt } = this;
    if (!flash || !bolt) return;
    if (still) {
      flash.setVisible(false);
      bolt.setVisible(false);
      return;
    }
    if (this.flashAt < 0 && frame.timeMs >= this.nextAt) {
      this.flashAt = frame.timeMs;
      this.flashMs = this.rng.range(BOLT.flashMs[0], BOLT.flashMs[1]);
      const range = BOLT.xRanges[this.rng.int(0, BOLT.xRanges.length - 1)] ?? BOLT.xRanges[0];
      this.boltX = frame.width * this.rng.range(range?.[0] ?? 0.1, range?.[1] ?? 0.26);
      this.nextAt = nextBoltAt(frame.timeMs, BOLT.everyMs, this.rng.next());
    }
    const strength =
      this.flashAt < 0 ? 0 : flashEnvelope(frame.timeMs - this.flashAt, this.flashMs);
    if (this.flashAt >= 0 && strength === 0 && frame.timeMs - this.flashAt >= this.flashMs) {
      this.flashAt = -1;
    }
    const on = strength > 0;
    flash.setVisible(on);
    bolt.setVisible(on);
    if (!on) return;
    flash.setPosition(bankX, 0).setAlpha(BOLT.flashAlpha * strength * frame.share);
    bolt.setPosition(this.boltX, BOLT.topY).setAlpha(BOLT.boltAlpha * frame.share);
  }
}

interface Star {
  image: Phaser.GameObjects.Image;
  u: number;
  v: number;
  alpha: number;
  periodMs: number;
  phase: number;
}

/**
 * The night sky: small stars (twinkling on full, still on lite and minimal) and a crescent moon at
 * the side, under the HUD plates and above the row of the incoming layer. Both stay out of the
 * middle strip behind the score and out of the flight row.
 */
export class WeatherNight implements WeatherPart {
  readonly objects: Phaser.GameObjects.Image[] = [];
  private readonly stars: Star[] = [];
  private readonly moon: Phaser.GameObjects.Image;
  private moonShown = false;

  constructor(scene: Phaser.Scene, rng: Rng) {
    for (let i = 0; i < NIGHT.stars; i++) {
      const frames = WEATHER_TEX.star;
      const image = new Phaser.GameObjects.Image(scene, 0, 0, frames[i % frames.length] ?? '');
      this.stars.push({
        image,
        u: rng.next(),
        v: rng.next(),
        alpha: rng.range(NIGHT.starAlpha[0], NIGHT.starAlpha[1]),
        periodMs: rng.range(NIGHT.twinkleMs[0], NIGHT.twinkleMs[1]),
        phase: rng.next() * TWO_PI,
      });
      this.objects.push(image);
    }
    this.moon = new Phaser.GameObjects.Image(scene, 0, 0, WEATHER_TEX.moon);
    this.objects.push(this.moon);
  }

  layout(frame: WeatherFrame): void {
    const { width, hudFloor, band } = frame;
    const m = NIGHT.moon;
    // The moon hangs right under the HUD floor on the left; with no room above the row it is left out.
    const y = hudFloor + m.radius + m.gapPx;
    this.moonShown = y + m.radius < band.top - NIGHT.aboveBandPx;
    this.moon.setPosition(width * m.xShare, y);
    const lowest = band.top - NIGHT.aboveBandPx;
    const [midFrom, midTo] = NIGHT.middleStrip;
    for (const s of this.stars) {
      let x = s.u * width;
      // Stars that would sit behind the score are moved to the side strips.
      if (x > midFrom * width && x < midTo * width)
        x = x < width / 2 ? midFrom * width * s.u : width - (1 - midTo) * width * s.u;
      s.image.setPosition(x, NIGHT.topMarginPx + s.v * Math.max(lowest - NIGHT.topMarginPx, 0));
    }
  }

  update(frame: WeatherFrame): void {
    const twinkle = frame.level === 'full';
    for (const s of this.stars) {
      const wave = twinkle
        ? 1 -
          NIGHT.twinkleDepth *
            (0.5 + 0.5 * Math.sin((TWO_PI * frame.timeMs) / s.periodMs + s.phase))
        : 1;
      const alpha =
        s.alpha *
        wave *
        frame.share *
        particleFade(s.image.y, frame.band, WEATHER_LOOK.bandFeatherPx, frame.height, 1);
      s.image.setAlpha(alpha).setVisible(alpha > 0.01);
    }
    this.moon.setVisible(this.moonShown && frame.share > 0).setAlpha(frame.share);
  }
}
