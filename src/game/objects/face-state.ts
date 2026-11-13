import { ANIM } from '../../data/anim';
import { pickRange } from '../../util/math';

export type MouthKind = 'smile' | 'open' | 'o' | 'flat' | 'scared' | 'yum';
export type EyeKind = 'open' | 'closed' | 'happy' | 'wide';
export type Mood = 'calm' | 'nervous' | 'scared';
/** Short-lived overrides, highest priority last: blink < joy < ouch < squint < horror. */
export type Reaction = 'blink' | 'joy' | 'ouch' | 'squint' | 'horror';

export interface Expression {
  eyes: EyeKind;
  mouth: MouthKind;
  brows: boolean;
  sweat: boolean;
}

/** Reactions from the weakest to the strongest. */
const REACTION_ORDER: readonly Reaction[] = ['blink', 'joy', 'ouch', 'squint', 'horror'];

function priority(reaction: Reaction): number {
  return REACTION_ORDER.indexOf(reaction);
}

/** How worried a tower with this wobble looks. */
export function moodForWobble(wobble: number): Mood {
  if (wobble > ANIM.wobble.dangerFrom) return 'scared';
  if (wobble > ANIM.wobble.nervousFrom) return 'nervous';
  return 'calm';
}

/**
 * Mouth of a layer that looks at a flying layer `dx` pixels off its own centre:
 * a wide grin when aimed well, a worried `o` near the edge, a smile between.
 */
export function aimMouth(dx: number, width: number): MouthKind {
  if (width <= 0) return 'smile';
  const share = Math.abs(dx) / width;
  if (share <= ANIM.flying.grinShare) return 'open';
  if (share >= ANIM.flying.edgeShare) return 'o';
  return 'smile';
}

function moodExpression(mood: Mood, mouthHint: MouthKind | undefined): Expression {
  switch (mood) {
    case 'nervous':
      return { eyes: 'open', mouth: 'flat', brows: false, sweat: false };
    case 'scared':
      return { eyes: 'open', mouth: 'scared', brows: false, sweat: true };
    case 'calm':
      return { eyes: 'open', mouth: mouthHint ?? 'smile', brows: false, sweat: false };
  }
}

/**
 * What a face shows. An active reaction overrides the mood; `mouthHint` replaces
 * the mouth of a calm face only (worried faces keep their worried mouth).
 */
export function resolveExpression(
  mood: Mood,
  reaction: Reaction | null,
  mouthHint?: MouthKind,
): Expression {
  const base = moodExpression(mood, mouthHint);
  switch (reaction) {
    case null:
      return base;
    case 'blink':
    case 'squint':
      return { ...base, eyes: 'closed' };
    case 'joy':
      return { eyes: 'happy', mouth: 'smile', brows: false, sweat: false };
    case 'ouch':
      return { ...base, mouth: 'o', brows: true };
    case 'horror':
      return { eyes: 'wide', mouth: 'scared', brows: true, sweat: true };
  }
}

/** Per-face timers: idle blinking and timed reactions with priority. */
export class FaceState {
  private current: Reaction | null = null;
  private leftMs = 0;
  /** Time left of an idle blink; 0 when the eyes are open. */
  private blinkLeftMs = 0;
  private untilBlinkMs = 0;

  constructor(private readonly random: () => number) {
    this.scheduleBlink();
  }

  update(dtMs: number): void {
    if (this.current) {
      this.leftMs -= dtMs;
      if (this.leftMs <= 0) this.clearReaction();
    }
    if (this.blinkLeftMs > 0) {
      this.blinkLeftMs -= dtMs;
      if (this.blinkLeftMs <= 0) {
        this.blinkLeftMs = 0;
        this.scheduleBlink();
      }
      return;
    }
    this.untilBlinkMs -= dtMs;
    if (this.untilBlinkMs <= 0) this.blinkLeftMs = ANIM.face.blinkMs;
  }

  /**
   * Starts a reaction for `ms`; a weaker reaction does not replace an active
   * stronger one. `ms = Infinity` holds it until `clearReaction()`.
   */
  react(reaction: Reaction, ms: number): void {
    if (!(ms > 0)) return;
    if (this.current && priority(reaction) < priority(this.current)) return;
    this.current = reaction;
    this.leftMs = ms;
  }

  clearReaction(): void {
    this.current = null;
    this.leftMs = 0;
  }

  /** Active reaction, or 'blink' while an idle blink runs, or null. */
  reaction(): Reaction | null {
    if (this.current) return this.current;
    return this.blinkLeftMs > 0 ? 'blink' : null;
  }

  /** Back to idle with a fresh blink timer (a pooled face was reused). */
  reset(): void {
    this.clearReaction();
    this.blinkLeftMs = 0;
    this.scheduleBlink();
  }

  private scheduleBlink(): void {
    this.untilBlinkMs = pickRange(ANIM.face.blinkIntervalMs, this.random);
  }
}
