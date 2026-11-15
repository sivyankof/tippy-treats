import type { CheckpointHeight, CheckpointRow } from '../../../core/checkpoints';

export type StartHeight = 0 | CheckpointHeight;

/** What the buttons under the steps show for the selected step. */
export interface CheckpointButtons {
  /**
   * `free`: "Play"; `pay`: "Play · price", grey with "Not enough N" when `missing` is above 0;
   * `none`: a locked step has no way to start.
   */
  main: { kind: 'free' } | { kind: 'none' } | { kind: 'pay'; price: number; missing: number };
  /** The second button: hidden, active, or grey "Ad unavailable". */
  ad: 'hidden' | 'ready' | 'unavailable';
  /** Today's ad starts are used up: no ad button, a caption under the price says so. */
  adSpent: boolean;
}

/** The step that stays selected after the rows changed: the same one while it is still open, else the free start. */
export function keepSelection(rows: readonly CheckpointRow[], selected: StartHeight): StartHeight {
  const row = rows.find((candidate) => candidate.height === selected);
  return row && !row.locked ? selected : 0;
}

/** The buttons of an open step; a locked or unknown one has none of the paid ways. */
export function buttonsFor(row: CheckpointRow): CheckpointButtons {
  if (row.locked) return { main: { kind: 'none' }, ad: 'hidden', adSpent: false };
  if (row.height === 0) return { main: { kind: 'free' }, ad: 'hidden', adSpent: false };
  return {
    main: { kind: 'pay', price: row.berries, missing: row.missing },
    ad: row.ad === 'none' || row.ad === 'spent' ? 'hidden' : row.ad,
    adSpent: row.ad === 'spent',
  };
}
