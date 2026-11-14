import type { CutSide } from '../../core/drop';
import { Rng } from '../../core/rng';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
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

/** Where a growing drip leaves the glaze: a low point of a tongue. */
export interface WaveDripSpot {
  x: number;
  tipY: number;
  /** Y where a drip `halfWidth` wide comes out of the tongue's edge (its sides). */
  rootY: number;
}

function spotAt(wave: GlazeWave, tongue: GlazeTongue, x: number, halfWidth: number): WaveDripSpot {
  const rootY = Math.max(
    tongueY(tongue, wave.crestY, x - halfWidth),
    tongueY(tongue, wave.crestY, x + halfWidth),
  );
  return { x, tipY: tongueY(tongue, wave.crestY, x), rootY };
}

/** The places one tongue may give drips at: none, the middle, one side of it, or a pair. */
function tongueOptions(tongue: GlazeTongue, clear: (x: number) => boolean): number[][] {
  const [near, far] = GLAZE_DRIPS.pairShares.map(
    (share) => tongue.x0 + (tongue.x1 - tongue.x0) * share,
  );
  const middle = (tongue.x0 + tongue.x1) / 2;
  const options: number[][] = [[]];
  for (const x of [middle, near!, far!]) if (clear(x)) options.push([x]);
  if (clear(near!) && clear(far!)) options.push([near!, far!]);
  return options;
}

/**
 * Every way the drips of a layer may be laid out (each a list of x from left to right), none
 * nearer to the centre than `faceClear` (the face of the layer): each tongue gives no drip, one
 * in its middle, one to a side of it, or a pair (`GLAZE_DRIPS.pairShares`); there is a drip on
 * each side of the face that has a tongue for one. A layout holds from `GLAZE_DRIPS.count[0]` up
 * to `most` drips; when that leaves fewer than two layouts (a narrow layer), fewer drips are let
 * in until there are two (or it is down to one drip). Always in the same order for a wave.
 */
export function dripLayouts(wave: GlazeWave, most: number, faceClear = 0): number[][] {
  const clear = (x: number): boolean => Math.abs(x) >= faceClear;
  const options = wave.tongues.map((t) => tongueOptions(t, clear)).filter((o) => o.length > 1);
  const sides = new Set(options.flat(2).map((x) => Math.sign(x)));
  const all: number[][] = [];
  const walk = (i: number, picked: number[]): void => {
    if (picked.length > most) return;
    if (i === options.length) {
      if (picked.length > 0) all.push(picked);
      return;
    }
    for (const option of options[i]!) walk(i + 1, option.length ? [...picked, ...option] : picked);
  };
  walk(0, []);
  const twoSided = (layout: number[]): boolean =>
    layout.length === 1 || [...sides].every((side) => layout.some((x) => Math.sign(x) === side));
  const fair = all.filter(twoSided);
  const fewest = fair.reduce((n, layout) => Math.min(n, layout.length), Infinity);
  let least = Math.max(fewest, Math.min(GLAZE_DRIPS.count[0], most));
  const within = (): number[][] => fair.filter((layout) => layout.length >= least);
  while (within().length < 2 && least > fewest) least--;
  return within();
}

/**
 * The layout of the drips of the layer with this 1-based number, out of `layouts`, picked from
 * the cosmetic stream `seed` like the look of the layer. Odd layers take the layouts at odd
 * places of the list, even layers those at even places, so two neighbouring layers of one width
 * never share a layout (unless there is only one).
 */
export function pickDripLayout(layouts: number[][], seed: number, layerIndex: number): number[] {
  const own = layouts.filter((_, i) => i % 2 === layerIndex % 2);
  const pool = own.length > 0 ? own : layouts;
  const rng = new Rng(seed).fork(`${GLAZE_DRIPS.layoutStream}:${layerIndex}`);
  return pool[rng.int(0, pool.length - 1)] ?? [];
}

/**
 * The places of the tongues the growing drips of the layer `layerIndex` come out of (see
 * `dripLayouts` and `pickDripLayout`): at most `most`, none nearer to the centre than `faceClear`.
 */
export function waveDripSpots(
  wave: GlazeWave,
  most: number,
  halfWidth: number,
  faceClear: number,
  seed: number,
  layerIndex: number,
): WaveDripSpot[] {
  const layout = pickDripLayout(dripLayouts(wave, most, faceClear), seed, layerIndex);
  const spots: WaveDripSpot[] = [];
  for (const x of layout) {
    const tongue = wave.tongues.find((t) => x > t.x0 && x < t.x1);
    if (tongue) spots.push(spotAt(wave, tongue, x, halfWidth));
  }
  return spots;
}
