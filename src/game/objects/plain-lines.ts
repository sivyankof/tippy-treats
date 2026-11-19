import type { CutSide } from '../../core/tower/drop';
import type { LayerBox } from './layer-draw';
import { cutStripWidth } from './glaze-wave';

/** A polyline as flat `[x0, y0, x1, y1, ...]`. */
export type Polyline = number[];

/** A stroke: one width and colour for a set of polylines. */
export interface Stroke {
  color: number;
  width: number;
  lines: Polyline[];
}

/**
 * The axis patterns are counted along: `u` runs from the uncut edge of the layer (the left
 * one, or the right one when the left is bitten) over the intact inner width, so what sits
 * near that edge stays put after a bite.
 */
export interface UAxis {
  anchor: number;
  dir: 1 | -1;
  length: number;
}

/** The axis for a layer with this bitten edge (`null`: an intact layer). */
export function uAxis(box: LayerBox, cut: CutSide | null): UAxis {
  const strip = cut ? cutStripWidth(box) : 0;
  const left = box.innerLeft + (cut === 'left' ? strip : 0);
  const right = box.innerRight - (cut === 'right' ? strip : 0);
  const fromRight = cut === 'left';
  return {
    anchor: fromRight ? right : left,
    dir: fromRight ? -1 : 1,
    length: Math.max(0, right - left),
  };
}

/** X at `u` on the axis. */
export function xAt(axis: UAxis, u: number): number {
  return axis.anchor + axis.dir * u;
}

/**
 * Samples `point(t)` from `t0` to `t1` on a grid of `step` anchored at 0 and keeps the stretches
 * where `inside` holds: one polyline per unbroken stretch, none shorter than two points.
 */
export function clipPolylines(
  point: (t: number) => readonly [number, number],
  t0: number,
  t1: number,
  step: number,
  inside: (x: number, y: number) => boolean,
): Polyline[] {
  const out: Polyline[] = [];
  let run: Polyline = [];
  const flush = (): void => {
    if (run.length >= 4) out.push(run);
    run = [];
  };
  for (let k = Math.ceil(t0 / step); k * step <= t1; k++) {
    const [x, y] = point(k * step);
    if (inside(x, y)) run.push(x, y);
    else flush();
  }
  flush();
  return out;
}
