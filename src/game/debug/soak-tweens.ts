/** What the soak needs to know of one tween to tell a lasting one from a passing one. */
export interface TweenFacts {
  /** Repeats for ever (`repeat: -1`). */
  infinite: boolean;
  paused: boolean;
  /** Time left to the end in ms; `null` when it is not known (a tween chain). */
  remainingMs: number | null;
}

/**
 * A tween that lasts: it never ends by itself (infinite or paused), or it ends later than
 * `horizonMs`, or its end is not known. A short finite tween still in flight is a passing one: it
 * ends on its own, so catching it mid-flight must not look like a leak.
 */
export function isLastingTween(tween: TweenFacts, horizonMs: number): boolean {
  if (tween.infinite || tween.paused) return true;
  return tween.remainingMs === null || tween.remainingMs > horizonMs;
}

/** How many of `tweens` last (see `isLastingTween`). */
export function countLastingTweens(tweens: readonly TweenFacts[], horizonMs: number): number {
  return tweens.filter((tween) => isLastingTween(tween, horizonMs)).length;
}

/** The fields of a Phaser tween read for `TweenFacts`; all optional, a chain has fewer of them. */
interface TweenLike {
  isInfinite?: boolean;
  paused?: boolean;
  totalDuration?: number;
  totalElapsed?: number;
  countdown?: number;
}

/** Reads the facts off a Phaser tween (`Tween` or `TweenChain`). */
export function tweenFacts(tween: unknown): TweenFacts {
  const t = tween as TweenLike;
  const { totalDuration, totalElapsed } = t;
  const known = typeof totalDuration === 'number' && typeof totalElapsed === 'number';
  return {
    infinite: t.isInfinite === true,
    paused: t.paused === true,
    remainingMs: known ? totalDuration - totalElapsed + Math.max(t.countdown ?? 0, 0) : null,
  };
}
