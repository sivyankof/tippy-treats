import { backOut, clamp01, lerp, TWO_PI } from '../../util/math';

/** A damped swing of a hanging mark (a glaze drop on a cut edge), around its origin. */
export interface MarkSwing {
  amplitudeDeg: number;
  periodMs: number;
  /** The amplitude falls to 1/e over this many ms. */
  decayMs: number;
}

/**
 * A mark squeezed out instead of growing evenly (the cream roll): its length (x) and height (y)
 * swell from nothing to `bulge` (anticipation), are pushed on to `over` (action and overshoot),
 * settle back to 1 with a small rebound, and then optionally sag slowly to `sag.to` and stay.
 */
export interface MarkSqueeze {
  /** The scale it shows at from its first frame (none: from nothing), so a small round bump appears rather than a sliver. */
  from?: readonly [number, number];
  bulgeMs: number;
  bulge: readonly [number, number];
  pushMs: number;
  over: readonly [number, number];
  settleMs: number;
  sag?: { ms: number; to: readonly [number, number] };
}

/**
 * One mark a layer keeps until the end of the run (docs/06, section 4, "Следы слоя"): a picture
 * of the shared atlas placed relative to the layer, so it rides, sways and squashes with it.
 */
export interface LayerMark {
  /** Texture key of the picture (a frame of the shared atlas). */
  texture: string;
  /** Where the origin of the picture sits, from the centre of the layer (view pixels, y down). */
  dx: number;
  dy: number;
  originX: number;
  originY: number;
  /** Size the picture is shown at. */
  width: number;
  height: number;
  flipX?: boolean;
  /** Colour the picture is tinted with (a picture baked light, shown in the glaze colour of its layer); none keeps its own colours. */
  tint?: number;
  /** Rest rotation, degrees. */
  angleDeg?: number;
  /** Scene time (ms) the mark was made: it grows in from there and the swing starts there. */
  bornMs: number;
  /** It grows from nothing to its size over this many ms (`backOut`), so it never pops in; 0 shows it at once. */
  growMs: number;
  swing?: MarkSwing;
  /** Squeezed out along its length and height separately (replaces `growMs`). */
  squeeze?: MarkSqueeze;
  /** How `tint` applies: multiplied (default), or as an overlay on a picture drawn in neutral greys (mid grey becomes the tint, white stays white). */
  tintMode?: 'multiply' | 'overlay';
  /** The layer above hides its baked shadow while this mark is there, so the shadow never greys it (the cream roll). */
  clearOfShadow?: boolean;
  /** The mark shrinks away from `startMs` over `durMs` (a stain licked off or melting); the store removes it after that. */
  vanish?: { startMs: number; durMs: number };
}

/** Marks of one layer: at most one drop from a cut (its outline and its fill) and one press mark (a stain, or a cream roll of up to five pictures). */
export interface LayerMarkSet {
  cut?: readonly LayerMark[];
  press?: readonly LayerMark[];
}

/** Most pictures the drop of a cut may have (an outline under a fill). */
export const MAX_CUT_PICTURES = 2;

/** Most pictures a press mark may have (a cream roll: two ridges and up to three drops). */
export const MAX_PRESS_PICTURES = 5;

/**
 * The marks of the current run per 1-based layer number. A view asks for them every time it shows
 * a layer, so a mark survives the view going to sleep and coming back. Cleared when a run starts.
 */
export class LayerMarkStore {
  private readonly byLayer = new Map<number, LayerMarkSet>();
  private changes = 0;
  /** Press marks that are vanishing: `sweep` has something to do only while this is above 0. */
  private vanishing = 0;

  /** Grows with every change of the store: a view that saw the same number has nothing new to place. */
  get version(): number {
    return this.changes;
  }

  clear(): void {
    this.byLayer.clear();
    this.vanishing = 0;
    this.changes++;
  }

  at(layerIndex: number): Readonly<LayerMarkSet> | undefined {
    return this.byLayer.get(layerIndex);
  }

  hasCut(layerIndex: number): boolean {
    return this.byLayer.get(layerIndex)?.cut !== undefined;
  }

  hasPress(layerIndex: number): boolean {
    return this.byLayer.get(layerIndex)?.press !== undefined;
  }

  /** True when the layer above this one must hide its baked shadow (a mark of this layer asks for it). */
  clearsShadowAbove(layerIndex: number): boolean {
    return this.byLayer.get(layerIndex)?.press?.some((m) => m.clearOfShadow === true) ?? false;
  }

  /** Leaves the drop of a cut on the layer; false (and nothing changes) when it already has one or `marks` is empty or too long. */
  addCut(layerIndex: number, marks: readonly LayerMark[]): boolean {
    if (marks.length === 0 || marks.length > MAX_CUT_PICTURES) return false;
    const set = this.setOf(layerIndex);
    if (set.cut) return false;
    set.cut = [...marks];
    this.changes++;
    return true;
  }

  /** Leaves a press mark on the layer; false (and nothing changes) when it already has one or `marks` is empty or too long. */
  addPress(layerIndex: number, marks: readonly LayerMark[]): boolean {
    if (marks.length === 0 || marks.length > MAX_PRESS_PICTURES) return false;
    const set = this.setOf(layerIndex);
    if (set.press) return false;
    set.press = [...marks];
    this.changes++;
    return true;
  }

  /** The layer's press mark starts shrinking away at `startMs` over `durMs`; false when it has none or already vanishes. */
  vanishPress(layerIndex: number, startMs: number, durMs: number): boolean {
    const set = this.byLayer.get(layerIndex);
    if (!set?.press || set.press.some((m) => m.vanish)) return false;
    set.press = set.press.map((m) => ({ ...m, vanish: { startMs, durMs } }));
    this.vanishing++;
    this.changes++;
    return true;
  }

  /** Takes the layer's press mark off at once; false when it has none. */
  removePress(layerIndex: number): boolean {
    const set = this.byLayer.get(layerIndex);
    if (!set?.press) return false;
    if (set.press.some((m) => m.vanish)) this.vanishing--;
    delete set.press;
    if (!set.cut) this.byLayer.delete(layerIndex);
    this.changes++;
    return true;
  }

  /** Removes the press marks whose vanishing is over at `nowMs`. */
  sweep(nowMs: number): void {
    if (this.vanishing <= 0) return;
    for (const [layerIndex, set] of [...this.byLayer]) {
      const mark = set.press?.[0]?.vanish;
      if (mark && nowMs >= mark.startMs + mark.durMs) this.removePress(layerIndex);
    }
  }

  private setOf(layerIndex: number): LayerMarkSet {
    let set = this.byLayer.get(layerIndex);
    if (!set) {
      set = {};
      this.byLayer.set(layerIndex, set);
    }
    return set;
  }
}

/** The marks of the run being played. */
export const layerMarks = new LayerMarkStore();

/** Grow-in scale of a mark `ageMs` after it was made. */
export function markGrow(mark: Readonly<LayerMark>, ageMs: number): number {
  if (mark.growMs <= 0) return 1;
  return Math.max(0, backOut(clamp01(ageMs / mark.growMs)));
}

/** Scale of a mark that is vanishing at `nowMs`: 1 before it starts, 0 when it is over (it shrinks, slowing at the end). */
export function markVanish(mark: Readonly<LayerMark>, nowMs: number): number {
  const v = mark.vanish;
  if (!v) return 1;
  const t = clamp01((nowMs - v.startMs) / Math.max(1, v.durMs));
  return 1 - t * t * (3 - 2 * t);
}

/** Swing angle of a mark `ageMs` after it was made, degrees (0 without a swing). */
export function markSwingDeg(mark: Readonly<LayerMark>, ageMs: number): number {
  const swing = mark.swing;
  if (!swing || ageMs < 0) return 0;
  const fade = Math.exp(-ageMs / swing.decayMs);
  if (fade < 0.01) return 0;
  return swing.amplitudeDeg * fade * Math.sin((TWO_PI * ageMs) / swing.periodMs);
}

/** Time a squeeze takes from the start to its final scale (the sag included). */
export function squeezeDoneMs(s: Readonly<MarkSqueeze>): number {
  return s.bulgeMs + s.pushMs + s.settleMs + (s.sag?.ms ?? 0);
}

/** Scale along `axis` (0 the length, 1 the height) of a squeezed mark `ageMs` after it was made. */
export function squeezeScale(s: Readonly<MarkSqueeze>, ageMs: number, axis: 0 | 1): number {
  if (ageMs <= 0) return 0;
  let t = ageMs;
  if (t < s.bulgeMs) {
    const u = t / s.bulgeMs;
    return lerp(s.from?.[axis] ?? 0, s.bulge[axis], 1 - (1 - u) * (1 - u));
  }
  t -= s.bulgeMs;
  if (t < s.pushMs) {
    const u = 1 - t / s.pushMs;
    return lerp(s.bulge[axis], s.over[axis], 1 - u * u * u);
  }
  t -= s.pushMs;
  if (t < s.settleMs) {
    // From the overshoot back past 1 by a third of it, and to rest at 1 with no speed left.
    const u = t / s.settleMs;
    return 1 + (s.over[axis] - 1) * Math.cos(1.5 * Math.PI * u) * (1 - u);
  }
  if (!s.sag) return 1;
  const u = clamp01((t - s.settleMs) / s.sag.ms);
  return lerp(1, s.sag.to[axis], u * u * (3 - 2 * u));
}
