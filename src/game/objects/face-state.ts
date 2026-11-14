import { ANIM } from '../../data/anim';
import type { FaceRecipe, MouthKind } from '../../data/creature-looks';
import { pickRange } from '../../util/math';

export type { MouthKind };
/** `wink`: the left eye is open, the right one shut. */
export type EyeKind = 'open' | 'closed' | 'happy' | 'wide' | 'wink';
export type Mood = 'calm' | 'nervous' | 'scared';
/**
 * Short-lived overrides, highest priority last: blink < lick < joy < ouch < the faces of the abilities
 * (wink, scrunch, gape, blow, puffed, strain) < squint < horror.
 */
export type Reaction =
  | 'blink'
  | 'lick'
  | 'joy'
  | 'ouch'
  | 'wink'
  | 'scrunch'
  | 'gape'
  | 'blow'
  | 'puffed'
  | 'strain'
  | 'squint'
  | 'horror';

export interface Expression {
  eyes: EyeKind;
  mouth: MouthKind;
  /** Brows are shown (always for a creature, only in "ouch" and "horror" for a plain layer). */
  brows: boolean;
  /** The brows take the creature's own pose; otherwise they are the worried "домиком" pair. */
  ownBrows: boolean;
  /** Half-closed eyes of a creature at rest (the recipe says how far). */
  lids: boolean;
  sweat: boolean;
  /** The cheeks are blown up (a puffed creature); absent means normal. */
  puffed?: boolean;
  /** The tongue is out (a plain layer licking glaze). */
  tongue?: boolean;
}

/** Reactions from the weakest to the strongest. */
const REACTION_ORDER: readonly Reaction[] = [
  'blink',
  'lick',
  'joy',
  'ouch',
  'wink',
  'scrunch',
  'gape',
  'blow',
  'puffed',
  'strain',
  'squint',
  'horror',
];

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

const PLAIN: Pick<Expression, 'brows' | 'ownBrows' | 'lids'> = {
  brows: false,
  ownBrows: false,
  lids: false,
};
const OWN: Pick<Expression, 'brows' | 'ownBrows' | 'lids'> = {
  brows: true,
  ownBrows: true,
  lids: false,
};

/**
 * The calm mouth: a hint that is not the plain smile (a grin, a worried `o`) wins, then the
 * creature's own default mouth, then the smile.
 */
function calmMouth(mouthHint: MouthKind | undefined, recipe: FaceRecipe | null): MouthKind {
  if (mouthHint && mouthHint !== 'smile') return mouthHint;
  return recipe?.mouth ?? mouthHint ?? 'smile';
}

function moodExpression(
  mood: Mood,
  mouthHint: MouthKind | undefined,
  recipe: FaceRecipe | null,
): Expression {
  const own = recipe ? OWN : PLAIN;
  switch (mood) {
    case 'nervous':
      return { eyes: 'open', mouth: 'flat', sweat: false, ...own };
    case 'scared':
      return { eyes: 'open', mouth: 'scared', sweat: true, ...own, ownBrows: false };
    case 'calm':
      return {
        eyes: 'open',
        mouth: calmMouth(mouthHint, recipe),
        sweat: false,
        ...own,
        lids: recipe !== null && (recipe.lidLeft > 0 || recipe.lidRight > 0),
      };
  }
}

/** The calm frame of the ability faces: brows as for the layer, no lids, no sweat. */
function abilityFace(
  recipe: FaceRecipe | null,
): Pick<Expression, 'brows' | 'ownBrows' | 'lids' | 'sweat'> {
  return { ...(recipe ? OWN : PLAIN), sweat: false };
}

/**
 * What a face shows. An active reaction overrides the mood; `mouthHint` replaces
 * the mouth of a calm face only (worried faces keep their worried mouth). A creature
 * (`recipe`) always has brows, a mouth of its own and, for sleepy ones, half-closed eyes.
 */
export function resolveExpression(
  mood: Mood,
  reaction: Reaction | null,
  mouthHint?: MouthKind,
  recipe: FaceRecipe | null = null,
): Expression {
  const base = moodExpression(mood, mouthHint, recipe);
  switch (reaction) {
    case null:
      return base;
    case 'blink':
    case 'squint':
      return { ...base, eyes: 'closed', lids: false };
    case 'lick':
      return { ...base, eyes: 'open', mouth: 'open', sweat: false, lids: false, tongue: true };
    case 'joy':
      return { eyes: 'happy', mouth: 'smile', sweat: false, ...(recipe ? OWN : PLAIN) };
    case 'ouch':
      return { ...base, mouth: 'o', brows: true, ownBrows: false, lids: false };
    case 'wink':
      return { ...abilityFace(recipe), eyes: 'wink', mouth: 'smile' };
    case 'scrunch':
      // Sour: eyes squeezed shut, a wavy mouth, worried brows.
      return {
        eyes: 'closed',
        mouth: 'scared',
        brows: true,
        ownBrows: false,
        lids: false,
        sweat: false,
      };
    case 'gape':
      return { ...abilityFace(recipe), eyes: 'open', mouth: 'open' };
    case 'blow':
      return { ...abilityFace(recipe), eyes: 'open', mouth: 'o' };
    case 'puffed':
      return { ...abilityFace(recipe), eyes: 'closed', mouth: 'flat', puffed: true };
    case 'strain':
      return { ...abilityFace(recipe), eyes: 'closed', mouth: 'flat' };
    case 'horror':
      return {
        eyes: 'wide',
        mouth: 'scared',
        brows: true,
        ownBrows: false,
        lids: false,
        sweat: true,
      };
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
