import { Rng } from '../../core/rng';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { smoothstep } from '../../util/math';

/** One row of ribs along an outline: where each one starts and how wide and high it is. */
export interface RibRow {
  /** Start and width as shares of the wedge length (the widths add up to 1), height 0..1. */
  start: number[];
  width: number[];
  height: number[];
}

/** The ribs of the top and of the bottom outline of one layer's wedge. */
export interface RibLayout {
  top: RibRow;
  bottom: RibRow;
}

const cfg = EDGE_SQUASH.ribs;
/** Where the crest of a rib is, as a share of its width from the wall side. */
const CREST = Math.pow(0.5, 1 / cfg.lean);

/** The whole wedge as one big dome at the wall: a soft layer with a wavy top has no ribs, only this smooth bubble. */
export const BUBBLE_RIBS: Readonly<RibLayout> = {
  top: { start: [0], width: [1], height: [1] },
  bottom: { start: [0], width: [1], height: [1] },
};

/** One row: widths and heights picked from the ranges of the layout `style`. */
function makeRow(rng: Rng, style: number): RibRow {
  const layout = cfg.styles[style % cfg.styles.length]!;
  const raw = layout.width.map(([lo, hi]) => rng.range(lo, hi));
  const sum = raw.reduce((a, b) => a + b, 0);
  const width: number[] = [];
  const start: number[] = [];
  const height: number[] = [];
  let at = 0;
  raw.forEach((w, i) => {
    const [lo, hi] = layout.height[i]!;
    start.push(at);
    width.push(w / sum);
    height.push(rng.range(lo, hi));
    at += w / sum;
  });
  return { start, width, height };
}

/**
 * The ribs of the layer with this 1-based number, for the cosmetic `seed` of the run: picked from
 * its own stream of that seed by the number alone (so the same layer always gets the same ones,
 * whatever order the layers are asked for in, and nothing is remembered). The top and the bottom
 * rows are independent and take different layouts (half the list apart), and the layout moves on with the number,
 * so two layers in a row never look alike.
 */
export function ribLayoutFor(seed: number, layerIndex: number): RibLayout {
  const n = Math.max(1, Math.floor(layerIndex));
  const rng = new Rng(seed).fork(`${cfg.stream}:${n}`);
  return {
    top: makeRow(rng.fork('top'), n),
    bottom: makeRow(rng.fork('bottom'), n + 2),
  };
}

/**
 * Height of one rib row at `t` along the wedge (0 at the wall, 1 where the wedge ends), 0..1: a
 * plump round bump per slot, its crest leaning towards the wall, smaller and smaller along the
 * wedge and gone at its end. The first rib starts at its crest, so it is full height right at the
 * wall. `last` (0..1) is how much of the farthest rib shows.
 */
export function ribHeight(row: Readonly<RibRow>, t: number, last: number): number {
  if (t < 0 || t >= 1) return 0;
  const n = row.start.length;
  for (let i = 0; i < n; i++) {
    const start = row.start[i]!;
    const width = row.width[i]!;
    if (t >= start + width && i < n - 1) continue;
    const along = (t - start) / width;
    if (along >= 1 || along < 0) return 0;
    // The rib at the wall only has its slope away from the wall.
    const x = i === 0 ? CREST + along * (1 - CREST) : along;
    // A plump dome with a soft foot: the foot eases in, so the hollow is a crease, not a spike.
    const foot = (i === 0 ? 1 : smoothstep(along / cfg.foot)) * smoothstep((1 - along) / cfg.foot);
    const bump = Math.pow(Math.sin(Math.PI * Math.pow(x, cfg.lean)), cfg.plump) * foot;
    const reveal = i === n - 1 ? last : 1;
    return row.height[i]! * bump * reveal * Math.pow(1 - t, cfg.fade);
  }
  return 0;
}

/** Where the hollows between the ribs are along the wedge (shares of its length): the starts of every rib but the first. */
export function hollowAt(row: Readonly<RibRow>, index: number): number {
  return row.start[index + 1] ?? 1;
}
