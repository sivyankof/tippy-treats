import type { EaseFn } from '../ease';

/** How a value travels from its start to its end: straight, out and back, or up and a sharp snap back. */
export type Shape = 'linear' | 'bump' | 'snap';

/** Share of the life at which a `snap` shape reaches its peak. */
const SNAP_PEAK = 0.6;

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** 0..1 curve of a shape at progress `t`; `bump` and `snap` return to 0 at the end. */
export function shapeAt(shape: Shape, t: number): number {
  const c = clamp01(t);
  switch (shape) {
    case 'linear':
      return c;
    case 'bump':
      return Math.sin(Math.PI * c);
    case 'snap': {
      if (c < SNAP_PEAK) return Math.sin((c / SNAP_PEAK) * (Math.PI / 2));
      const back = (c - SNAP_PEAK) / (1 - SNAP_PEAK);
      return 1 - back * back;
    }
  }
}

/** Everything a short-lived effect sprite does: where it goes, how it scales, turns and fades. */
export interface SpriteSpec {
  texture: string;
  tint: number;
  depth: number;
  originX: number;
  originY: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The path bulges up by this much in the middle (a crumb flying in an arc). */
  arc: number;
  scaleX0: number;
  scaleX1: number;
  scaleY0: number;
  scaleY1: number;
  angle0: number;
  angle1: number;
  alpha0: number;
  alpha1: number;
  /** Easing of the position (and angle). */
  move: EaseFn;
  scaleShape: Shape;
  alphaShape: Shape;
  /** Waits this long before it shows. */
  delayMs: number;
  lifeMs: number;
  /** Pinned to the screen instead of the world. */
  screen: boolean;
  /** Adds light instead of covering. */
  additive: boolean;
}

/** Pose of a sprite at a moment; `sampleSprite` fills a reused one. */
export interface SpriteFrame {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  alpha: number;
}

const linear: EaseFn = (t) => t;

/**
 * A spec from the few fields that matter. Scale defaults: `scaleX1` follows `scaleX0`, `scaleY0`
 * follows `scaleX0`, `scaleY1` follows `scaleX1`; the rest stays still, opaque and linear.
 */
export function makeSpec(
  base: Pick<SpriteSpec, 'texture' | 'x0' | 'y0' | 'lifeMs'> & Partial<SpriteSpec>,
): SpriteSpec {
  const sx0 = base.scaleX0 ?? 1;
  const sx1 = base.scaleX1 ?? sx0;
  return {
    tint: 0xffffff,
    depth: 0,
    originX: 0.5,
    originY: 0.5,
    x1: base.x0,
    y1: base.y0,
    arc: 0,
    angle0: 0,
    angle1: 0,
    alpha0: 1,
    alpha1: 1,
    move: linear,
    scaleShape: 'linear',
    alphaShape: 'linear',
    delayMs: 0,
    screen: false,
    additive: false,
    ...base,
    scaleX0: sx0,
    scaleX1: sx1,
    scaleY0: base.scaleY0 ?? sx0,
    scaleY1: base.scaleY1 ?? sx1,
  };
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Pose of the sprite at progress `t` (0..1) of its life. */
export function sampleSprite(spec: SpriteSpec, t: number, out: SpriteFrame): SpriteFrame {
  const c = clamp01(t);
  const k = spec.move(c);
  out.x = lerp(spec.x0, spec.x1, k);
  out.y = lerp(spec.y0, spec.y1, k) - spec.arc * Math.sin(Math.PI * c);
  out.angle = lerp(spec.angle0, spec.angle1, k);
  const s = shapeAt(spec.scaleShape, c);
  out.scaleX = lerp(spec.scaleX0, spec.scaleX1, s);
  out.scaleY = lerp(spec.scaleY0, spec.scaleY1, s);
  out.alpha = lerp(spec.alpha0, spec.alpha1, shapeAt(spec.alphaShape, c));
  return out;
}
