import { flyingSpeed, type SpeedFields } from '../../core/flight';
import type { FlyingLayer, SimPhase } from '../../core/tower-sim';
import { ZONE_RULES } from '../../data/zones';

/** The fields of the flying layer the rule visuals read. */
export type RuleFields = SpeedFields & Pick<FlyingLayer, 'coverMs'>;

/** What the screen should show for the rule of the flying layer right now. */
export interface RuleVisual {
  /** Red outline of a rush layer: from its spawn until it is dropped. */
  outline: boolean;
  /** The rush layer holds still and gathers itself. */
  winding: boolean;
  /** Progress of the wind-up, 0..1; 0 outside of it. */
  windupProgress: number;
  /** Speed streaks: 0 for none, up to 1 for the strongest. */
  streaks: number;
  /** Colour family of the streaks: the red-hot rush dash or the plain roof wind. */
  streakKind: 'rush' | 'wind';
  /** A cloud hides the layer. */
  covered: boolean;
}

/** A visual with nothing going on; also the starting value of a reused one. */
export function idleVisual(): RuleVisual {
  return {
    outline: false,
    winding: false,
    windupProgress: 0,
    streaks: 0,
    streakKind: 'wind',
    covered: false,
  };
}

/** A cloud hides the layer: it hangs there while the layer flies and lets go once it is dropped. */
export function isCovered(layer: Pick<FlyingLayer, 'coverMs'> | null, phase: SimPhase): boolean {
  return layer !== null && phase === 'flying' && layer.coverMs > 0;
}

/** Roof wind strength from the speed ratio: 0 at the slow edge profile, 1 at the fast centre one. */
export function windStrength(speedRatio: number): number {
  const { edgeMult, centreMult } = ZONE_RULES.roof;
  return Math.min(1, Math.max(0, (speedRatio - edgeMult) / (centreMult - edgeMult)));
}

/**
 * Fills `out` with the rule visual of a flying layer. Everything is read off the layer (the
 * sim decides, the screen only shows): a rush shows its outline from the spawn, the wind-up
 * is the time the layer holds still, the streaks follow `flyingSpeed`, the cloud follows
 * `coverMs`. Once the layer is dropped (`phase` is not `flying`) all of it stops.
 */
export function ruleVisual(
  layer: Readonly<RuleFields> | null,
  phase: SimPhase,
  out: RuleVisual,
): RuleVisual {
  out.outline = false;
  out.winding = false;
  out.windupProgress = 0;
  out.streaks = 0;
  out.streakKind = 'wind';
  out.covered = false;
  if (!layer || phase !== 'flying') return out;

  out.outline = layer.rush;
  out.covered = isCovered(layer, phase);
  if (layer.windupMs > 0) {
    out.winding = true;
    out.windupProgress = 1 - layer.windupMs / ZONE_RULES.rush.windupMs;
    return out;
  }
  if (layer.rush) {
    out.streaks = layer.stopMs > 0 ? 0 : 1;
    out.streakKind = 'rush';
  } else if (layer.rule === 'roof' && layer.speed > 0) {
    out.streaks = windStrength(flyingSpeed(layer) / layer.speed);
  }
  return out;
}
