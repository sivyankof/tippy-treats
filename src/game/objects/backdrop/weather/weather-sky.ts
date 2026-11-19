import * as Phaser from 'phaser';
import { Rng } from '../../../../core/common/rng';
import type { WeatherId } from '../../../../data/weather/weather';
import { STRIKE_SIDES, WEATHER_LOOK, WEATHER_TEX } from '../../../../data/weather/weather-look';
import type { ZoneId } from '../../../../data/zones/zones';
import { TWO_PI } from '../../../../util/math';
import { effectsMode } from '../../../app/effects-mode';
import { FLIGHT_CLEAR } from '../../../../data/backdrop/flight-clear';
import { flightClearBand, hudFloor, hudKeepOutFade, hudPlates } from '../../../run/camera-layout';
import type { FrameCtx, Life } from '../life/life';
import { inSky } from '../life/layer-anchor';
import { fxGuard } from '../../../common/fx-guard';
import { playFx } from '../../../audio/fx-sound';
import { bankFlashKey, bankKey } from './weather-art';
import { announceFlash } from './lightning-flash';
import { zoneShowsWeatherSky } from './weather-share';
import { bankEdge, boltEnd, flashEnvelope, nextBoltAt } from './weather-motion';

const BANK = WEATHER_LOOK.bank;
const BOLT = WEATHER_LOOK.lightning;
const NIGHT = WEATHER_LOOK.night;

/**
 * How a bank is shown: the Roof and the Clouds take the picture at `BANK.scale`; the street behind the Showcase
 * glass shows it lower and paler, with flashes but no bolt (`STREET_WEATHER.bank`).
 */
export interface BankView {
  scaleX: number;
  scaleY: number;
  alpha: number;
  driftPx: number;
  flashShare: number;
  bolt: boolean;
}

const SKY_BANK: BankView = {
  scaleX: BANK.scale,
  scaleY: BANK.scale,
  alpha: 1,
  driftPx: BANK.driftPx,
  flashShare: 1,
  bolt: true,
};

/** Cloud banks of storms that are alive; filled in development only, for the debug hook. */
const BANKS = new Set<WeatherBank>();

/** Debug: every live storm bank strikes right away; how many there are. */
export function strikeLightningNow(): number {
  for (const bank of BANKS) bank.strikeNow();
  return BANKS.size;
}

/**
 * The cloud bank of rain and storm: one opaque figure that is part of the zone's sky, drawn over the
 * four parallax layers (see `SceneryDef.weatherSky`). It drifts slowly on full and lite and stands still on minimal. A storm adds lightning: the
 * same puffs lit from inside (a twin picture of the bank) and a jagged bolt with a branch that starts in
 * the cloud and may leave it a little at the bottom, in a flash of 120-180 ms
 * every 8-15 s (full and lite; minimal none).
 */
export class WeatherBank implements Life {
  readonly anchor = inSky('weather');
  readonly objects: Phaser.GameObjects.Image[];
  /** The bank picture itself, and what lights it (the flashes and the bolt): `objects` is the two in turn. */
  readonly body: Phaser.GameObjects.Image;
  readonly lit: Phaser.GameObjects.Image[];
  /** The lit twin of the bank for a bolt on the left and on the right. */
  private readonly flashes: Phaser.GameObjects.Image[] = [];
  private readonly bolt: Phaser.GameObjects.Image | null = null;
  /** Time of the next bolt; drawn from the first frame on, since the scene clock does not start at 0. */
  private nextAt = -1;
  private readonly firstU: number;
  private flashAt = -1;
  private flashMs = 0;
  /** Where the strike stands (screen px) and whether it has a bolt (it may find no free place). */
  private strike: { x: number; y: number; scale: number; side: number } | null = null;
  /** Which flash picture lights this time (the side of the strike, drawn when it has no place). */
  private side = 0;
  private pending = false;
  /** How bright the flash is now (0..1), and on which side it lights (the street glows with it). */
  private strength = 0;

  constructor(
    scene: Phaser.Scene,
    weather: WeatherId,
    private readonly rng: Rng,
    private readonly view: BankView = SKY_BANK,
  ) {
    this.body = new Phaser.GameObjects.Image(scene, 0, 0, bankKey(weather))
      .setOrigin(0.5, 0)
      .setScale(view.scaleX, view.scaleY)
      .setAlpha(view.alpha);
    this.lit = [];
    if (weather === 'storm') {
      for (let side = 0; side < STRIKE_SIDES.length; side++) {
        this.flashes.push(
          new Phaser.GameObjects.Image(scene, 0, 0, bankFlashKey(side))
            .setOrigin(0.5, 0)
            .setScale(view.scaleX, view.scaleY)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setVisible(false),
        );
      }
      this.lit.push(...this.flashes);
      if (view.bolt) {
        this.bolt = new Phaser.GameObjects.Image(scene, 0, 0, WEATHER_TEX.bolt)
          .setOrigin(0.5, 0)
          .setVisible(false);
        this.lit.push(this.bolt);
      }
    }
    this.objects = [this.body, ...this.lit];
    if (weather === 'storm') {
      if (import.meta.env.DEV) {
        BANKS.add(this);
        this.body.once(Phaser.GameObjects.Events.DESTROY, () => BANKS.delete(this));
      }
    }
    this.firstU = rng.next();
  }

  /** How bright the flash of this frame is (0..1, 0 when none shows). */
  get flashStrength(): number {
    return this.strength;
  }

  /** Where the flash of this frame is centred, in px of the bank picture across. */
  get flashSpotX(): number {
    return BANK.flashSpots[this.side]?.x ?? BANK.width / 2;
  }

  /** Debug: the next bolt strikes at the next frame. */
  strikeNow(): void {
    this.pending = true;
  }

  update(ctx: FrameCtx): void {
    const still = effectsMode.level === 'minimal';
    const drift = still ? 0 : this.view.driftPx * Math.sin((TWO_PI * ctx.timeMs) / BANK.driftMs);
    const x = ctx.width / 2 + drift;
    this.body.setPosition(x, 0);
    if (this.flashes.length > 0) this.updateStrike(ctx, x, still);
  }

  private updateStrike(ctx: FrameCtx, bankX: number, still: boolean): void {
    const { flashes, bolt } = this;
    if (still) {
      this.strength = 0;
      for (const flash of flashes) flash.setVisible(false);
      bolt?.setVisible(false);
      return;
    }
    const now = ctx.timeMs;
    if (this.nextAt < 0) this.nextAt = nextBoltAt(now, BOLT.firstMs, this.firstU);
    if (this.flashAt < 0 && (this.pending || now >= this.nextAt)) {
      this.pending = false;
      this.flashAt = now;
      this.flashMs = this.rng.range(BOLT.flashMs[0], BOLT.flashMs[1]);
      this.strike = bolt ? this.pickStrike(ctx, bankX) : null;
      this.side = this.strike?.side ?? this.rng.int(0, STRIKE_SIDES.length - 1);
      this.nextAt = nextBoltAt(now, BOLT.everyMs, this.rng.next());
      // The layers of the tower start at the flash; the glass of the Showcase (no bolt) scares them less.
      const kind = this.view.bolt ? 'sky' : 'street';
      fxGuard.run('startle', () => announceFlash(kind));
      // The thunder comes late (the sound picks its own delay); behind the glass it is muffled.
      playFx('thunder', kind === 'street');
    }
    const strength = this.flashAt < 0 ? 0 : flashEnvelope(now - this.flashAt, this.flashMs);
    this.strength = strength;
    if (this.flashAt >= 0 && now - this.flashAt >= this.flashMs) this.flashAt = -1;
    const strike = this.strike;
    flashes.forEach((flash, i) => flash.setVisible(strength > 0 && i === this.side));
    bolt?.setVisible(strength > 0 && strike !== null);
    if (strength <= 0) return;
    // The lit twin of the bank follows it as it drifts; its glow is one patch with no edge but the puffs.
    this.flashes[this.side]
      ?.setPosition(bankX, 0)
      .setAlpha(BOLT.flashAlpha * this.view.flashShare * strength);
    if (strike === null || !bolt) return;
    bolt.setPosition(strike.x, strike.y).setScale(strike.scale).setAlpha(1);
  }

  /**
   * A place for the bolt in the middle part of the cloud: it starts a little way down from the top, is as
   * long as `lengthShare` of the cloud's height there (so its tip may leave the lower edge by a few
   * percent of its length), and its width and its length clear every HUD plate by the HUD gap.
   * `null` when the draws find none (the flash plays without a bolt).
   */
  private pickStrike(
    ctx: FrameCtx,
    bankX: number,
  ): { x: number; y: number; scale: number; side: number } | null {
    for (let i = 0; i < BOLT.tries; i++) {
      const side = this.rng.int(0, STRIKE_SIDES.length - 1);
      const range = STRIKE_SIDES[side]?.x;
      if (!range) return null;
      const x = ctx.width * this.rng.range(range[0], range[1]);
      const edge = bankEdge((x - bankX) / BANK.scale + BANK.width / 2, true) * BANK.scale;
      if (edge < BOLT.minCloudPx) continue;
      const top = edge * BOLT.topShare;
      const end = top + edge * BOLT.lengthShare;
      if (end - top < BOLT.height * BOLT.minLengthShare) continue;
      const half = BOLT.width * ((end - top) / BOLT.height) * BOLT.hudHalfShare;
      const room = boltEnd(x, half, top, end, hudPlates(), FLIGHT_CLEAR.hudGapPx);
      if (room === null || room - top < BOLT.height * BOLT.minLengthShare) continue;
      return { x, y: top, scale: (room - top) / BOLT.height, side };
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
 * minimal) and the crescent moon, both in the zone's sky, drawn over the four parallax layers. A star is never shown
 * inside the HUD plates plus the HUD gap or in the flight row; the moon hangs at the HUD floor on
 * the left and is left out when there is no room above the row.
 */
export class WeatherNight implements Life {
  readonly anchor = inSky('weather');
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
  if (!zoneShowsWeatherSky(zone)) return [];
  const rng = new Rng(WEATHER_LOOK.skySeed).fork(`${weather}_sky`);
  if (weather === 'rain' || weather === 'storm') return [new WeatherBank(scene, weather, rng)];
  if (weather === 'night') return [new WeatherNight(scene, rng)];
  return [];
}
