import { SOAK } from '../../data/soak';

/** The counts read before and after the smoke lap (`tippySoak.smoke()`). */
export interface SmokeCounts {
  objects: number;
  listeners: number;
  /** Tweens that last (infinite, paused or longer than `SOAK.smoke.shortTweenMs`); the verdict compares these. */
  tweens: number;
  /** All tweens, passing ones included: for diagnosis, not compared. */
  rawTweens: number;
  timers: number;
  /** Live audio nodes (`AudioService.debugStats`); compared within `SOAK.audioNodesTolerance`. */
  audioNodes: number;
}

/** The counts compared before and after the lap (timers are reported, not compared). */
const COMPARED = ['objects', 'listeners', 'tweens'] as const;

/**
 * Names of the compared counts that differ between `a` and `b`; empty when they agree. The audio
 * node count may differ by the tolerance (sounds in flight, music notes scheduled ahead).
 */
export function differing(
  a: SmokeCounts,
  b: SmokeCounts,
  audioTolerance: number = SOAK.audioNodesTolerance,
): string[] {
  const names: string[] = COMPARED.filter((name) => a[name] !== b[name]);
  if (Math.abs(a.audioNodes - b.audioNodes) > audioTolerance) names.push('audioNodes');
  return names;
}
