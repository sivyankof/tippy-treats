import { RAINBOW_LOOK } from '../../../data/rainbow-look';
import { TWO_PI } from '../../../util/math';
import type { Pt } from '../../fx/plain-style';
import type { LayerBox } from '../layer-draw';

const { wave } = RAINBOW_LOOK;
const STAR_POINTS = 5;

/** Height of the wave at `x`: the same for every band edge. */
export function waveAt(x: number): number {
  return wave.amplitude * Math.sin((TWO_PI * x) / wave.length);
}

/** The y range of the body inside its outline at `x`: the rounded corners cut into it near the sides. */
export function bodySpan(box: LayerBox, x: number): { top: number; bottom: number } {
  const r = box.innerRadius;
  const fromSide = Math.min(x - box.innerLeft, box.innerRight - x);
  if (r <= 0 || fromSide >= r) return { top: box.innerTop, bottom: box.innerBottom };
  const dx = r - Math.max(0, fromSide);
  const cut = r - Math.sqrt(Math.max(0, r * r - dx * dx));
  return { top: box.innerTop + cut, bottom: box.innerBottom - cut };
}

/** x of every sample from the left to the right side of the body, `step` apart, the right side included. */
export function sampleXs(box: LayerBox, step: number): number[] {
  const xs: number[] = [];
  for (let x = box.innerLeft; x < box.innerRight; x += step) xs.push(x);
  xs.push(box.innerRight);
  return xs;
}

/** A line `y` pixels down with the wave on it (`waved` false: straight), kept inside the body. */
export function bandEdge(box: LayerBox, y: number, waved: boolean, xs: readonly number[]): Pt[] {
  return xs.map((x) => {
    const span = bodySpan(box, x);
    const raw = y + (waved ? waveAt(x) : 0);
    return { x, y: Math.min(span.bottom, Math.max(span.top, raw)) };
  });
}

/** The closed outline of the band between two edges: the top left to right, the bottom right to left. */
export function bandPolygon(top: readonly Pt[], bottom: readonly Pt[]): Pt[] {
  return [...top, ...[...bottom].reverse()];
}

/** The wavy line `y` pixels down between `x0` and `x1`, for a stroke that follows a band. */
export function waveLine(x0: number, x1: number, y: number, step: number): Pt[] {
  const points: Pt[] = [];
  for (let x = x0; x < x1; x += step) points.push({ x, y: y + waveAt(x) });
  points.push({ x: x1, y: y + waveAt(x1) });
  return points;
}

/** The outline of a five-pointed star of outer radius `outer` at (`cx`, `cy`), point up, notches `notch` of the radius deep. */
export function starPoints(cx: number, cy: number, outer: number, notch: number): Pt[] {
  const points: Pt[] = [];
  for (let i = 0; i < STAR_POINTS * 2; i++) {
    const r = i % 2 === 0 ? outer : outer * notch;
    const a = -Math.PI / 2 + (Math.PI * i) / STAR_POINTS;
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return points;
}

/** Tops of the coloured sponges and the cream strips: `room` is the height under the glaze, the stack is centred in it. */
export function spongeRows(
  top: number,
  room: number,
  count: number,
): Array<{ top: number; bottom: number }> {
  const { sponge, cream } = RAINBOW_LOOK.band;
  const rows: Array<{ top: number; bottom: number }> = [];
  const total = (count * sponge + (count - 1) * cream) * room;
  let y = top + (room - total) / 2;
  for (let i = 0; i < count; i++) {
    rows.push({ top: y, bottom: y + sponge * room });
    y += (sponge + cream) * room;
  }
  return rows;
}
