import * as Phaser from 'phaser';
import type { Rng } from '../../../core/rng';
import { LOGICAL_SIZE } from '../../../data/screen';
import { WEATHER_LOOK, WEATHER_TEX } from '../../../data/weather-look';
import { clamp01, MS_PER_SECOND, TWO_PI } from '../../../util/math';
import { laneCount, snowSpots, startU } from './weather-lanes';
import {
  particleFade,
  particleKeepOut,
  fallShown,
  type FallView,
  rainX,
  rainY,
  rainSpots,
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
  keepOutFeatherPx?: number;
  endFeatherPx?: number;
}

const FRAME_SETS: Record<string, readonly string[]> = {
  drop: [WEATHER_TEX.drop],
  flake: WEATHER_TEX.flake,
  leaf: WEATHER_TEX.leaf,
};

function draw(rng: Rng, range: Range | undefined, fallback: number): number {
  return range ? rng.range(range[0], range[1]) : fallback;
}

/**
 * Rain, snow or leaves: a fixed pool of images of one atlas, moved by closed formulas of the
 * time (nothing is allocated per frame). The pool is sized for the full level; lower levels show
 * the first part of it. They fade out toward the stripe of the incoming layer.
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
    const strip = look.sideShare ?? WEATHER_LOOK.sideShare;
    const snow = kind === 'snow';
    const rain = kind === 'rain' || kind === 'storm';
    // Most start in the side strips (a kind may set its own `sideBias` and `sideShare`); the rest anywhere.
    const drawU = (): number => startU(rng, look.sideBias ?? WEATHER_LOOK.sideBias, strip);
    // Snow falls in lanes (one speed per lane, see weather-lanes.ts); the rest start anywhere.
    const lanes = laneCount(LOGICAL_SIZE.width, WEATHER_LOOK.snow.laneGapPx);
    const spots = snow ? snowSpots(count, lanes, drawU, () => rng.next()) : [];
    // Rain: x and y of the drops are each spread evenly over the screen in a shuffled order, so the count beside the tower holds.
    const rainAt = rain ? rainSpots(count, () => rng.next()) : [];
    // Raindrops fall at one speed, as real ones do: it keeps their spread even as they fall.
    const rainSpeed = rain ? draw(rng, look.speed, 0) : 0;
    const laneSpeed = new Map<number, number>();
    for (let i = 0; i < count; i++) {
      const { lane, u, v } = spots[i] ?? {
        lane: 0,
        u: rain ? (rainAt[i]?.u ?? 0) : drawU(),
        v: rain ? (rainAt[i]?.v ?? 0) : rng.next(),
      };
      let speed = rain ? rainSpeed : draw(rng, look.speed, 0);
      if (snow) {
        speed = laneSpeed.get(lane) ?? speed;
        laneSpeed.set(lane, speed);
      }
      this.specs.push({
        u,
        v,
        speed,
        sway: draw(rng, look.swayPx, 0),
        swayMs: draw(rng, look.swayMs, 1),
        spinMs: draw(rng, look.spinMs, 1),
        phase: rng.next() * TWO_PI,
        scale: draw(rng, look.scale, 1) * (view?.scale ?? 1),
        alpha: draw(rng, look.alpha, 1) * (view?.alpha ?? 1),
      });
      const index = snow ? this.flakeSize(rng) : i % Math.max(frames.length, 1);
      this.objects.push(
        new Phaser.GameObjects.Image(scene, 0, 0, frames[index] ?? '').setVisible(false),
      );
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
    const pad = this.look.endFeatherPx ?? WEATHER_LOOK.endFeatherPx;
    const bandFeather = this.look.bandFeatherPx ?? WEATHER_LOOK.bandFeatherPx;
    const keepFeather = this.look.keepOutFeatherPx ?? WEATHER_LOOK.keepOutFeatherPx;
    const leaf = this.kind === 'leaves';
    const slant = this.look.slant ?? 0;
    // A raindrop is turned along the way it really falls.
    const slantRad = rain ? -Math.atan(slant) : 0;
    const tilt = this.look.tiltRad ?? 0;
    const swayLag = this.look.swayLag ?? 0;
    const turnMin = this.look.turnMin ?? 1;
    const top = frame.hudFloor;
    const margin = WEATHER_LOOK.rainWrapMarginPx;
    for (let i = 0; i < this.objects.length; i++) {
      const image = this.objects[i];
      const p = this.specs[i];
      if (!image || !p) continue;
      if (i >= shown) {
        image.setVisible(false);
        continue;
      }
      const y = rain
        ? rainY(p.v, p.speed, seconds, top, height, 0, band)
        : wrapRange(p.v * height + p.speed * seconds, height, pad);
      const x = rain
        ? rainX(p.u, slant, y, top, width, margin)
        : p.u * width + p.sway * Math.sin((TWO_PI * t) / p.swayMs + p.phase);
      // The whole picture keeps out of the HUD gap: its half size, and for a raindrop its slanted length.
      const reach = (image.width * p.scale) / 2;
      const alpha =
        particleFade(y, band, bandFeather, height, pad) *
        (rain ? clamp01((y - top) / pad) : 1) *
        (rain
          ? particleKeepOut(
              x,
              y,
              keepFeather,
              reach,
              Math.max((image.height * p.scale) / 2 - reach, 0),
              slantRad,
            )
          : particleKeepOut(x, y, keepFeather, Math.max(reach, (image.height * p.scale) / 2))) *
        frame.share *
        p.alpha;
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
