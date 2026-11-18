import type { SquashKind } from '../../data/topper-squash';

export type { SquashKind };

/**
 * Named moments of the decorative run effects that have sounds (docs/06, section 7; the listener
 * is `cue-sounds.ts`): the strands of a cut starting to pull, each strand snapping, the glaze drop
 * falling, a cut piece starting to panic, a topper squashed (`cream` is the roller's press).
 */
export type EffectCue =
  | { kind: 'cutStretch' }
  | { kind: 'cutStrandSnap' }
  | { kind: 'cutDrip' }
  | { kind: 'cutPanic' }
  | { kind: 'topperSquash'; topper: SquashKind };

type CueListener = (cue: Readonly<EffectCue>) => void;

/** Where the effects report their moments; the run listens with `listenCueSounds`. */
export class EffectCues {
  private listener: CueListener | null = null;

  /** Sets the one listener (`null` removes it). */
  listen(listener: CueListener | null): void {
    this.listener = listener;
  }

  emit(cue: Readonly<EffectCue>): void {
    this.listener?.(cue);
  }
}

export const effectCues = new EffectCues();
