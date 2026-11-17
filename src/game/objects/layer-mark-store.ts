import { backOut, clamp01, TWO_PI } from '../../util/math';

/** A damped swing of a hanging mark (a glaze drop on a cut edge), around its origin. */
export interface MarkSwing {
  amplitudeDeg: number;
  periodMs: number;
  /** The amplitude falls to 1/e over this many ms. */
  decayMs: number;
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
  /** The mark shrinks away from `startMs` over `durMs` (a stain licked off or melting); the store removes it after that. */
  vanish?: { startMs: number; durMs: number };
}

/** Marks of one layer: at most one drop from a cut (its outline and its fill) and one press mark (a stain, or a cream roll of up to two pictures). */
export interface LayerMarkSet {
  cut?: readonly LayerMark[];
  press?: readonly LayerMark[];
}

/** Most pictures the drop of a cut may have (an outline under a fill). */
export const MAX_CUT_PICTURES = 2;

/** Most pictures a press mark may have (a cream roll squeezed out on both sides). */
export const MAX_PRESS_PICTURES = 2;

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
