import type { CutSide } from '../../core/drop';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { GOLDEN } from '../../util/math';
import type { LayerBox } from './layer-draw';

/** One round tongue of the glaze edge, between two peaks at the crest. */
export interface GlazeTongue {
  x0: number;
  x1: number;
  /** How far its lowest point hangs below the crest. */
  depth: number;
}

/** The wavy lower edge of the glaze of a plain layer, around the layer centre. */
export interface GlazeWave {
  /** Y of the peaks between the tongues (and of the edge at both ends). */
  crestY: number;
  /** The stretch the tongues fill: the inner width minus the sponge of a bitten edge. */
  left: number;
  right: number;
  tongues: GlazeTongue[];
}

/** Width of the sponge strip on a bitten edge. */
export function cutStripWidth(box: LayerBox): number {
  return Math.max(0, Math.min(PLAIN_LAYER.cut.width, box.innerW / 2));
}

/** Y of the glaze peaks (the shallowest glaze) of a layer. */
export function glazeCrestY(box: LayerBox): number {
  return box.innerTop + box.height * PLAIN_LAYER.glaze.crestShare;
}

/**
 * The glaze edge of a plain layer of this box and bitten edge. The stretch is cut into whole
 * tongues of about `tongueWidth`, so any width ends on a peak at both sides and a bitten edge
 * never shows half a tongue. Tongues are counted from the intact edge, so their lengths do not
 * change there after a bite; the ones in front of the face (`faceHalf` either side of the
 * centre; `null`: a faceless piece) are shorter.
 */
export function glazeWave(box: LayerBox, cut: CutSide | null, faceHalf: number | null): GlazeWave {
  const spec = PLAIN_LAYER.glaze;
  const strip = cut ? cutStripWidth(box) : 0;
  const left = box.innerLeft + (cut === 'left' ? strip : 0);
  const right = box.innerRight - (cut === 'right' ? strip : 0);
  const crestY = glazeCrestY(box);
  const span = right - left;
  const tongues: GlazeTongue[] = [];
  if (span <= 0) return { crestY, left, right, tongues };
  const count = Math.max(1, Math.round(span / spec.tongueWidth));
  const step = span / count;
  const longest = box.height * spec.tongueShare;
  for (let i = 0; i < count; i++) {
    // Numbered from the intact edge: the left one, or the right one when the left is bitten.
    const k = cut === 'left' ? count - 1 - i : i;
    const x0 = left + step * i;
    const x1 = x0 + step;
    const share = 1 - spec.tongueVariation * (((k + 1) * GOLDEN) % 1);
    const middle = (x0 + x1) / 2;
    const facing = faceHalf !== null && Math.abs(middle) < faceHalf;
    tongues.push({ x0, x1, depth: longest * share * (facing ? spec.faceShorten : 1) });
  }
  return { crestY, left, right, tongues };
}

/** Y of a tongue's edge at `x` (inside the tongue). */
export function tongueY(tongue: GlazeTongue, crestY: number, x: number): number {
  const t = (x - tongue.x0) / (tongue.x1 - tongue.x0);
  if (!(t > 0 && t < 1)) return crestY;
  return crestY + tongue.depth * Math.pow(Math.sin(Math.PI * t), PLAIN_LAYER.glaze.roundness);
}

/** Y of the glaze edge at `x`; the crest outside the tongues. */
export function waveY(wave: GlazeWave, x: number): number {
  for (const tongue of wave.tongues) {
    if (x >= tongue.x0 && x <= tongue.x1) return tongueY(tongue, wave.crestY, x);
  }
  return wave.crestY;
}

/** Points of the edge from left to right, flat `[x0, y0, x1, y1, ...]`; each peak once. */
export function waveEdge(wave: GlazeWave): number[] {
  const samples = PLAIN_LAYER.glaze.samplesPerTongue;
  const out: number[] = [];
  wave.tongues.forEach((tongue, i) => {
    for (let s = i === 0 ? 0 : 1; s <= samples; s++) {
      const x = tongue.x0 + ((tongue.x1 - tongue.x0) * s) / samples;
      out.push(x, tongueY(tongue, wave.crestY, x));
    }
  });
  return out;
}

/** Where a growing drip leaves the glaze: the middle of a tongue and its lowest point. */
export interface WaveDripSpot {
  x: number;
  tipY: number;
  /** Y where a drip `halfWidth` wide comes out of the tongue's edge (its sides). */
  rootY: number;
}

/**
 * The tongues the growing drips come out of: the ones nearest to `count` evenly spread points,
 * each tongue at most once.
 */
export function waveDripSpots(wave: GlazeWave, count: number, halfWidth: number): WaveDripSpot[] {
  const spots: WaveDripSpot[] = [];
  const used = new Set<GlazeTongue>();
  const span = wave.right - wave.left;
  for (let i = 0; i < count; i++) {
    const target = wave.left + (span * (i + 1)) / (count + 1);
    let best: GlazeTongue | null = null;
    for (const tongue of wave.tongues) {
      if (used.has(tongue)) continue;
      const d = Math.abs((tongue.x0 + tongue.x1) / 2 - target);
      if (!best || d < Math.abs((best.x0 + best.x1) / 2 - target)) best = tongue;
    }
    if (!best) break;
    used.add(best);
    const x = (best.x0 + best.x1) / 2;
    const rootY = Math.max(
      tongueY(best, wave.crestY, x - halfWidth),
      tongueY(best, wave.crestY, x + halfWidth),
    );
    spots.push({ x, tipY: wave.crestY + best.depth, rootY });
  }
  return spots.sort((a, b) => a.x - b.x);
}
