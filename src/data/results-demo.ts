import type { CreatureId } from './creatures';

/**
 * Synthetic runs for `?resultsDemo=<case>` (dev builds only): the results screen with every block
 * filled, to check how it fits short screens (docs/07-ui-screens.md, section 6).
 */
export const RESULTS_DEMO_CASES = ['normal', 'checkpoint', 'record', 'daily'] as const;

export type ResultsDemoCase = (typeof RESULTS_DEMO_CASES)[number];

export function isResultsDemoCase(value: string | null): value is ResultsDemoCase {
  return (RESULTS_DEMO_CASES as readonly string[]).includes(value ?? '');
}

/** What every case shares: the run, its coins by source and the creatures whose abilities went off. */
export const RESULTS_DEMO = {
  height: 38,
  score: 4820,
  bestCombo: 7,
  perfects: 12,
  coins: { floating: 120, combo: 80, perfect: 60, crumb: 30, golden: 40, height: 82, mastery: 0 },
  abilities: [
    ['honey', 6],
    ['jelly', 4],
    ['caramel', 3],
    ['frosty', 2],
  ] as ReadonlyArray<readonly [CreatureId, number]>,
  xpGained: 140,
  oven: { fresh: 6, left: 0, ranOut: true },
  /** Three missions in progress: id, target, progress before and after the run. */
  missions: [
    { id: 'perfects_25', group: 'medium', target: 25, before: 8, after: 20 },
    { id: 'combo_8', group: 'hard', target: 8, before: 3, after: 7 },
    { id: 'floating_coins_40', group: 'medium', target: 40, before: 14, after: 34 },
  ] as const,
  /** The best classic height before a run that is not a record, and before one that is. */
  /** The checkpoints this tall a classic tower reached are shown as open, so the start buttons appear (the save is not touched). */
  priorRunHeight: 80,
  /** The seed, the length and the peak wobble of the demo run. */
  seed: 1,
  durationMs: 90_000,
  maxWobble: 0.5,
  previousRecord: 45,
  previousRecordBeaten: 31,
  checkpoint: { start: 20 as const, height: 58 },
  record: { height: 52 },
  daily: {
    height: 52,
    tiers: [
      { height: 30, cost: { coins: 150 } },
      { height: 50, cost: { berries: 3 } },
    ],
  },
};
