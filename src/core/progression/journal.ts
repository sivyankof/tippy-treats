// The counters of the baker's journal and their tiers (docs/04-meta-retention.md, section 11).
import { JOURNAL, type JournalRowId } from '../../data/progression/journal';
import type { Save } from '../save/schema';

/** Where a counter stands among its tiers. */
export interface TierPlace {
  /** Index of the reached tier (0: below the first real one). */
  index: number;
  /** Where the reached tier starts. */
  from: number;
  /** Where the next tier starts; `null` on the top tier. */
  next: number | null;
  /** Share of the way from 0 to `next`, 0..1, as the bar text "value / next" reads; 1 on the top tier. */
  share: number;
}

/** The tier `value` reached; `tiers` start at their `from`, ascending, the first at 0. */
export function tierPlace(value: number, tiers: readonly { from: number }[]): TierPlace {
  let index = 0;
  for (let i = 1; i < tiers.length; i++) {
    if (value >= (tiers[i]?.from ?? Infinity)) index = i;
  }
  const from = tiers[index]?.from ?? 0;
  const next = tiers[index + 1]?.from ?? null;
  const share = next === null ? 1 : Math.min(1, Math.max(0, value / next));
  return { index, from, next, share };
}

/** The counters the journal shows, in the units of their tiers. */
export type JournalCounts = Record<JournalRowId | 'flies', number>;

/** Two decimals at most: a product of a count and a size must not show float noise. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The counters of all time: height in metres and glaze in litres come from the layers. */
export function journalCounts(stats: Readonly<Save['stats']>): JournalCounts {
  return {
    flies: stats.flies,
    layers: stats.totalLayers,
    height: round2(stats.totalLayers * JOURNAL.layerHeightM),
    glaze: round2(stats.totalLayers * JOURNAL.glazePerLayerL),
    perfects: stats.perfects,
    runs: stats.runs,
  };
}

/** The tiers of a counter of the journal. */
export function journalTiers(id: JournalRowId | 'flies'): readonly { from: number }[] {
  return id === 'flies' ? JOURNAL.flies : JOURNAL.rows[id];
}
