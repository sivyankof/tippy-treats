import { RULE_ANIM } from '../../data/rule-anim';
import { clamp01 } from '../../util/math';

const burst = RULE_ANIM.streaks.burst;

/** Shape of the alpha along one run of a streak. */
export interface StreakEnvelope {
  fadeInShare: number;
  fadeOutShare: number;
}

/**
 * Alpha factor 0..1 at `run` 0..1 of a streak's run: it fades in over `fadeInShare`, holds its
 * peak, then fades out over the last `fadeOutShare`.
 */
export function streakEnvelope(run: number, shape: StreakEnvelope): number {
  const t = clamp01(run);
  const fadeIn = shape.fadeInShare > 0 ? Math.min(1, t / shape.fadeInShare) : 1;
  const fadeOut = shape.fadeOutShare > 0 ? Math.min(1, (1 - t) / shape.fadeOutShare) : 1;
  return fadeIn * fadeOut;
}

/** How strong the release burst of the streaks still is, 1 at the release down to 0 after `burst.ms`. */
export function burstBoost(sinceReleaseMs: number): number {
  const left = 1 - clamp01(sinceReleaseMs / burst.ms);
  return left * left;
}
