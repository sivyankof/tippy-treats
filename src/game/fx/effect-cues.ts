import type { SquashKind } from '../../data/topper-squash';

export type { SquashKind };

/**
 * Named moments of the decorative run effects that will get their sounds later (docs/06,
 * section 7): the strands of a cut snapping, a cut piece starting to panic, a topper squashed.
 */
export type EffectCue =
  { kind: 'cutStrandSnap' } | { kind: 'cutPanic' } | { kind: 'topperSquash'; topper: SquashKind };

type CueListener = (cue: Readonly<EffectCue>) => void;

/** Where the effects report their moments; nothing listens until the sounds are made. */
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
