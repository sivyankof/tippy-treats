import * as Phaser from 'phaser';
import type { Rng } from '../../../../core/common/rng';
import { LOGICAL_SIZE } from '../../../../data/app/screen';
import { WEATHER_LOOK, WEATHER_TEX } from '../../../../data/weather/weather-look';
import { MS_PER_SECOND, TWO_PI } from '../../../../util/math';
import { laneCount, snowSpots, startU } from './weather-lanes';
import {
  fallShown,
  type FallView,
  flightRowShade,
  rainX,
  rainY,
  rainSpots,
  sideWarp,
  wrapPad,
  wrapRange,
} from './weather-motion';
import type { WeatherFrame, WeatherPart } from './weather-frame';

export type FallKind = 'rain' | 'storm' | 'snow' | 'leaves';

interface Particle {
  /** Start position as shares of the screen. */
  u: number;
  v: number;
  speed: number;
  sway: number;
  swayMs: number;
  spinMs: number;
  phase: number;
  scale: number;
  alpha: number;
  /** How far beyond the screen edges it wraps (`wrapPad`), fixed by its picture and scale. */
  pad: number;
}

type Range = readonly [number, number];
/** The numbers of one kind; the fields only some kinds have are optional. */
interface FallLook {
  frames: readonly string[];
  count: number;
  speed: Range;
  scale: Range;
  alpha: Range;
  slant?: number;
  swayPx?: Range;
  swayMs?: Range;
  spinMs?: Range;
  tiltRad?: number;
  swayLag?: number;
  turnMin?: number;
  sizeCuts?: readonly number[];
  sideBias?: number;
  sideShare?: number;
  bandFeatherPx?: number;
}

const FRAME_SETS: Record<string, readonly string[]> = {
  drop: [WEATHER_TEX.drop],
  flake: WEATHER_TEX.flake,
  leaf: WEATHER_TEX.leaf,
};

function tintOf(
  image: Phaser.GameObjects.Image,
  tint: number | undefined,
): Phaser.GameObjects.Image {
  return tint === undefined ? image : image.setTint(tint);
}

function draw(rng: Rng, range: Range | undefined, fallback: number): number {
  return range ? rng.range(range[0], range[1]) : fallback;
}

/**
 * Rain, snow or leaves: a fixed pool of images of one atlas, moved by closed formulas of the
 * time (nothing is allocated per frame). The pool is sized for the full level; lower levels show
 * the first part of it. They fall over the whole screen, behind the HUD plates, and are paler in the row of the
 * incoming layer (`flightRowShade`).
 */
export class WeatherFall implements WeatherPart {
  readonly objects: Phaser.GameObjects.Image[] = [];
  private readonly specs: Particle[] = [];
  private readonly look: FallLook;

  constructor(
    scene: Phaser.Scene,
    private readonly kind: FallKind,
    rng: Rng,
    private readonly view: FallView | null = null,
  ) {
    this.look = WEATHER_LOOK[kind] as FallLook;
    const look = this.look;
    const frames = FRAME_SETS[look.frames[0] ?? ''] ?? [];
    const count = Math.min(view?.count ?? look.count, WEATHER_LOOK.particleCount.full);
    const strip = view?.sides?.share ?? look.sideShare ?? WEATHER_LOOK.sideShare;
    const snow = kind === 'snow';
    const rain = kind === 'rain' || kind === 'storm';
    // Most start in the side strips (a kind may set its own `sideBias` and `sideShare`); the rest anywhere.
    const drawU = (): number =>
      startU(rng, view?.sides?.bias ?? look.sideBias ?? WEATHER_LOOK.sideBias, strip);
    // Snow falls in lanes (one speed per lane, see weather-lanes.ts); the rest start anywhere.
    const lanes = laneCount(LOGICAL_SIZE.width, WEATHER_LOOK.snow.laneGapPx);
    const spots = snow ? snowSpots(count, lanes, drawU, () => rng.next()) : [];
    // Rain: x and y of the drops are each spread evenly over the screen in a shuffled order, so the count beside the tower holds.
    const rainAt = rain ? rainSpots(count, () => rng.next()) : [];
    // Raindrops fall at one speed, as real ones do: it keeps their spread even as they fall.
    const rainSpeed = rain ? draw(rng, look.speed, 0) : 0;
    const outside = view?.outside;
    const rainU = (u: number): number =>
      outside ? sideWarp(u, outside.share, outside.stripShare) : u;
    const laneSpeed = new Map<number, number>();
    for (let i = 0; i < count; i++) {
      const { lane, u, v } = spots[i] ?? {
        lane: 0,
        u: rain ? rainU(rainAt[i]?.u ?? 0) : drawU(),
        v: rain ? (rainAt[i]?.v ?? 0) : rng.next(),
      };
      let speed = rain ? rainSpeed : draw(rng, look.speed, 0);
      if (snow) {
        speed = laneSpeed.get(lane) ?? speed;
        laneSpeed.set(lane, speed);
      }
      const sway = draw(rng, look.swayPx, 0);
      const swayMs = draw(rng, look.swayMs, 1);
      const spinMs = draw(rng, look.spinMs, 1);
      const phase = rng.next() * TWO_PI;
      const scale = draw(rng, look.scale, 1) * (view?.scale ?? 1);
      const alpha = draw(rng, look.alpha, 1) * (view?.alpha ?? 1);
      const index = snow ? this.flakeSize(rng) : i % Math.max(frames.length, 1);
      const image = tintOf(
        new Phaser.GameObjects.Image(scene, 0, 0, frames[index] ?? '').setVisible(false),
        view?.tint,
      );
      const pad = wrapPad(image.width, image.height, scale);
      this.specs.push({ u, v, speed, sway, swayMs, spinMs, phase, scale, alpha, pad });
      this.objects.push(image);
    }
  }

  private flakeSize(rng: Rng): number {
    const r = rng.next();
    const cuts = WEATHER_LOOK.snow.sizeCuts;
    const at = cuts.findIndex((cut) => r < cut);
    return at < 0 ? cuts.length : at;
  }

  update(frame: WeatherFrame): void {
    const rain = this.kind === 'rain' || this.kind === 'storm';
    const shown =
      frame.share > 0 ? fallShown(this.objects.length, frame.level, rain, this.view) : 0;
    const t = frame.timeMs;
    const seconds = t / MS_PER_SECOND;
    const { width, height, band } = frame;
    const bandFeather = this.look.bandFeatherPx ?? WEATHER_LOOK.bandFeatherPx;
    const dim = WEATHER_LOOK.flightRowAlpha;
    const leaf = this.kind === 'leaves';
    const slant = (this.look.slant ?? 0) * (this.view?.slantShare ?? 1);
    // A raindrop is turned along the way it really falls.
    const slantRad = rain ? -Math.atan(slant) : 0;
    const tilt = this.look.tiltRad ?? 0;
    const swayLag = this.look.swayLag ?? 0;
    const turnMin = this.look.turnMin ?? 1;
    const margin = WEATHER_LOOK.rainWrapMarginPx;
    for (let i = 0; i < this.objects.length; i++) {
      const image = this.objects[i];
      const p = this.specs[i];
      if (!image || !p) continue;
      if (i >= shown) {
        image.setVisible(false);
        continue;
      }
      // The jump back up happens beyond the screen edges (`p.pad`), so it is never seen.
      const y = rain
        ? rainY(p.v, p.speed, seconds, height, p.pad)
        : wrapRange(p.v * height + p.speed * seconds, height, p.pad);
      const x = rain
        ? rainX(p.u, slant, y, width, margin)
        : p.u * width + p.sway * Math.sin((TWO_PI * t) / p.swayMs + p.phase);
      const alpha = flightRowShade(y, band, bandFeather, dim) * frame.share * p.alpha;
      if (alpha <= 0.01) {
        image.setVisible(false);
        continue;
      }
      image.setVisible(true).setPosition(x, y).setAlpha(alpha);
      if (rain) {
        image.setRotation(slantRad).setScale(p.scale);
      } else if (leaf) {
        const turn = Math.abs(Math.cos((TWO_PI * t) / p.spinMs + p.phase));
        const sway = Math.sin((TWO_PI * t) / p.swayMs + p.phase + swayLag);
        image
          .setRotation(tilt * sway + p.phase)
          .setScale(p.scale, p.scale * (turnMin + (1 - turnMin) * turn));
      } else {
        image.setScale(p.scale);
      }
    }
  }
}
