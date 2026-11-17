import * as Phaser from 'phaser';
import type { Rng } from '../../../core/rng';
import { LOGICAL_SIZE } from '../../../data/screen';
import { WEATHER_LOOK, WEATHER_TEX } from '../../../data/weather-look';
import { MS_PER_SECOND, TWO_PI } from '../../../util/math';
import { laneCount, snowSpots } from './weather-lanes';
import { particleFade, particleKeepOut, rainDropsShown, wrapRange } from './weather-motion';
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
  private readonly slantRad: number;

  constructor(
    scene: Phaser.Scene,
    private readonly kind: FallKind,
    rng: Rng,
  ) {
    this.look = WEATHER_LOOK[kind] as FallLook;
    const look = this.look;
    const frames = FRAME_SETS[look.frames[0] ?? ''] ?? [];
    this.slantRad = -Math.atan(look.slant ?? 0);
    const count = Math.min(look.count, WEATHER_LOOK.particleCount.full);
    const strip = look.sideShare ?? WEATHER_LOOK.sideShare;
    const snow = kind === 'snow';
    // Snow starts anywhere across the whole width (behind the tower it is simply hidden); the rest keep to the sides.
    const drawU = (): number => {
      if (snow) return rng.next();
      const sideStrip = rng.chance(look.sideBias ?? WEATHER_LOOK.sideBias);
      const left = rng.chance(0.5);
      return sideStrip ? (left ? rng.range(0, strip) : rng.range(1 - strip, 1)) : rng.next();
    };
    // Snow falls in lanes (one speed per lane, see weather-lanes.ts); the rest start anywhere.
    const lanes = laneCount(LOGICAL_SIZE.width, WEATHER_LOOK.snow.laneGapPx);
    const spots = snow ? snowSpots(count, lanes, drawU, () => rng.next()) : [];
    const laneSpeed = new Map<number, number>();
    for (let i = 0; i < count; i++) {
      const { lane, u, v } = spots[i] ?? { lane: 0, u: drawU(), v: rng.next() };
      let speed = draw(rng, look.speed, 0);
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
        scale: draw(rng, look.scale, 1),
        alpha: draw(rng, look.alpha, 1),
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
      frame.share > 0
        ? rain
          ? rainDropsShown(this.objects.length, frame.level)
          : Math.round(
              (this.objects.length * WEATHER_LOOK.particleCount[frame.level]) /
                WEATHER_LOOK.particleCount.full,
            )
        : 0;
    const t = frame.timeMs;
    const seconds = t / MS_PER_SECOND;
    const { width, height, band } = frame;
    const pad = this.look.endFeatherPx ?? WEATHER_LOOK.endFeatherPx;
    const bandFeather = this.look.bandFeatherPx ?? WEATHER_LOOK.bandFeatherPx;
    const keepFeather = this.look.keepOutFeatherPx ?? WEATHER_LOOK.keepOutFeatherPx;
    const leaf = this.kind === 'leaves';
    const slant = this.look.slant ?? 0;
    const tilt = this.look.tiltRad ?? 0;
    const swayLag = this.look.swayLag ?? 0;
    const turnMin = this.look.turnMin ?? 1;
    for (let i = 0; i < this.objects.length; i++) {
      const image = this.objects[i];
      const p = this.specs[i];
      if (!image || !p) continue;
      if (i >= shown) {
        image.setVisible(false);
        continue;
      }
      const y = wrapRange(p.v * height + p.speed * seconds, height, pad);
      const x = rain
        ? wrapRange(p.u * width + slant * p.speed * seconds, width, pad)
        : p.u * width + p.sway * Math.sin((TWO_PI * t) / p.swayMs + p.phase);
      const alpha =
        particleFade(y, band, bandFeather, height, pad) *
        particleKeepOut(x, y, keepFeather) *
        frame.share *
        p.alpha;
      if (alpha <= 0.01) {
        image.setVisible(false);
        continue;
      }
      image.setVisible(true).setPosition(x, y).setAlpha(alpha);
      if (rain) {
        image.setRotation(this.slantRad).setScale(p.scale);
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
