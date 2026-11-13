import { SFX } from '../../data/sfx';

/** Frequency ratio of a pitch shifted by `semitones`. */
export function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / SFX.semitonesPerOctave);
}

/** Frequency of the note `semitones` above `rootFreq`. */
export function noteFreq(rootFreq: number, semitones: number): number {
  return rootFreq * semitoneRatio(semitones);
}

/** Combo step limited to the ladder: 1..ladder length. Garbage input counts as the first step. */
export function clampComboStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.max(1, Math.min(SFX.perfect.ladderSemitones.length, Math.floor(step)));
}

/** Bell pitch for a combo step on the major pentatonic ladder; steps beyond the top stay there. */
export function comboNoteFreq(step: number): number {
  const semitones = SFX.perfect.ladderSemitones[clampComboStep(step) - 1] ?? 0;
  return noteFreq(SFX.perfect.rootFreq, semitones);
}

/** Bell loudness multiplier for a combo step (1 for the first, growing to a cap). */
export function comboGainScale(step: number): number {
  return Math.min(
    SFX.perfect.maxGainScale,
    1 + SFX.perfect.gainPerStep * (clampComboStep(step) - 1),
  );
}

/** Random pitch multiplier within `1 +- spread`. */
export function jitterRatio(spread: number, random: () => number = Math.random): number {
  return 1 + (random() * 2 - 1) * spread;
}

/** Loudness share of the `index`-th slap in a collapse series (0 = first); falls off, never below the floor. */
export function collapseThudGain(index: number): number {
  const steps = Math.max(0, Number.isFinite(index) ? index : 0);
  return Math.max(SFX.collapse.gainFloor, Math.pow(SFX.collapse.gainFalloff, steps));
}
