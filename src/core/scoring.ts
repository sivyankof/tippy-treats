import { BALANCE } from '../data/balance';

/** Combo counter after a landed drop. */
export function nextCombo(combo: number, perfect: boolean): number {
  return perfect ? combo + 1 : 0;
}

/**
 * How much a perfect drop widens the layer at the given combo
 * (the combo value already includes this drop).
 */
export function comboWidening(combo: number, width: number): number {
  if (combo < BALANCE.combo.widenFrom) return 0;
  const room = Math.max(0, BALANCE.layer.maxWidth - width);
  return Math.min(BALANCE.combo.widenBy, room);
}

export function normalScore(scoreMult: number): number {
  return Math.round(BALANCE.score.normal * scoreMult);
}

/** Score for a perfect drop; `combo` already includes this drop. */
export function perfectScore(combo: number, scoreMult: number): number {
  const { perfectBase, perfectPerCombo } = BALANCE.score;
  const steps = Math.min(combo, BALANCE.combo.scoreCap);
  return Math.round((perfectBase + perfectPerCombo * steps) * scoreMult);
}
