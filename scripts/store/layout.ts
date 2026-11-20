/**
 * Pure layout of the store shots (no DOM): how a caption breaks into lines and how big it may be,
 * and the wavy top edge of the caption plate. The numbers come from `STORE_CAPTION` and
 * `STORE_PLATE` (`src/data/debug/store-shots.ts`).
 */

export interface CaptionLimits {
  /** Largest and smallest font size, px. */
  maxSize: number;
  minSize: number;
  /** Width and height the text block must fit, px. */
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  /** Line height as a share of the font size. */
  lineHeight: number;
  /** A word this short (a preposition, a conjunction, a number, `&`) never ends a line: it goes with the next word. */
  glueUpTo: number;
  /** Each line past the first counts the size times this, so a second line has to pay for itself. */
  moreLinesCost: number;
}

export interface CaptionFit {
  lines: string[];
  size: number;
}

/** Sizes closer than this count as equal, px. */
const SIZE_EPSILON = 0.5;

/** Words with each short one joined to the word after it (`И ПРОКАЧИВАЙ!`, `12 СПОСОБНОСТЕЙ!`, `& LEVEL`). */
export function glueShortWords(words: readonly string[], upTo: number): string[] {
  const out: string[] = [];
  let carry = '';
  for (const word of words) {
    const joined = carry ? `${carry} ${word}` : word;
    if (word.replace(/[^\p{L}\p{N}&]/gu, '').length <= upTo) carry = joined;
    else {
      out.push(joined);
      carry = '';
    }
  }
  if (carry) {
    if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]!} ${carry}`;
    else out.push(carry);
  }
  return out;
}

/** Every way to cut `words` into `count` lines between words, in order. */
function splits(words: readonly string[], count: number): string[][] {
  if (count === 1) return [[words.join(' ')]];
  const out: string[][] = [];
  for (let cut = 1; cut <= words.length - count + 1; cut++) {
    const head = words.slice(0, cut).join(' ');
    for (const rest of splits(words.slice(cut), count - 1)) out.push([head, ...rest]);
  }
  return out;
}

/**
 * The caption at the largest size that fits: one line, or more lines broken only between words
 * (never inside a word). `widthAt1` is the drawn width of a line at a font size of 1 px (the
 * width grows with the size); a second line has to make it larger by more than `moreLinesCost`
 * takes. A tie keeps fewer lines, then the more even ones. Null when even the smallest size does not fit.
 */
export function fitCaption(
  text: string,
  widthAt1: (line: string) => number,
  limits: CaptionLimits,
): CaptionFit | null {
  const words = glueShortWords(text.trim().split(/\s+/), limits.glueUpTo);
  let best: (CaptionFit & { widest: number; score: number }) | null = null;
  for (let count = 1; count <= Math.min(limits.maxLines, words.length); count++) {
    for (const lines of splits(words, count)) {
      const widest = Math.max(...lines.map(widthAt1));
      const size = Math.min(
        limits.maxSize,
        limits.maxWidth / widest,
        limits.maxHeight / (count * limits.lineHeight),
      );
      if (size < limits.minSize) continue;
      const score = size * limits.moreLinesCost ** (count - 1);
      const bigger = !best || score > best.score + SIZE_EPSILON;
      const evener =
        best !== null &&
        Math.abs(score - best.score) <= SIZE_EPSILON &&
        lines.length === best.lines.length &&
        widest < best.widest;
      if (bigger || evener) best = { lines, size, widest, score };
    }
  }
  return best && { lines: best.lines, size: best.size };
}

export interface WaveSpec {
  /** Width of the shot, px. */
  width: number;
  /** Mean y of the wavy edge, px. */
  top: number;
  amplitude: number;
  /** Length of one wave, px. */
  length: number;
  /** Where the first crest is, a share of a wave. */
  phase: number;
}

/** Points of the wavy edge from the left side to the right, one every `step` px (both ends included). */
export function wavePoints(spec: WaveSpec, step: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const count = Math.max(1, Math.ceil(spec.width / step));
  for (let i = 0; i <= count; i++) {
    const x = (spec.width * i) / count;
    const turn = (x / spec.length - spec.phase) * Math.PI * 2;
    points.push({ x, y: spec.top - spec.amplitude * Math.cos(turn) });
  }
  return points;
}
