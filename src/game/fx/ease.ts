import * as Phaser from 'phaser';

/** Easing curve: progress 0..1 in, eased progress out. */
export type EaseFn = (t: number) => number;

/** Looks up an easing function by the name used in ANIM, e.g. `'Quad.easeIn'`. */
export function easeFn(name: string): EaseFn {
  return Phaser.Tweens.Builders.GetEaseFunction(name) as EaseFn;
}
