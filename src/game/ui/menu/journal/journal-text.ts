// The words and numbers of the baker's journal (docs/07-ui-screens.md, section 2.2).
import {
  journalTiers,
  tierPlace,
  type JournalCounts,
  type TierPlace,
} from '../../../../core/progression/journal';
import { JOURNAL, type JournalRowId } from '../../../../data/progression/journal';
import { formatDecimal, formatNumber, t, tn } from '../../../../i18n';

export type JournalCounter = JournalRowId | 'flies';

/** The number as it is shown: one decimal below `JOURNAL.decimalsBelow`, whole above. */
function shown(value: number): number {
  return value < JOURNAL.decimalsBelow ? Math.round(value * 10) / 10 : Math.round(value);
}

const sized = (value: number): string => formatDecimal(shown(value));

/** A number of a counter as the row shows it: plain, metres (km from `kmFromM`) or litres. */
export function journalAmount(id: JournalCounter, value: number): string {
  if (id === 'height') {
    return value >= JOURNAL.kmFromM
      ? t('journal.unit.km', { amount: sized(value / JOURNAL.kmFromM) })
      : t('journal.unit.m', { amount: sized(value) });
  }
  if (id === 'glaze') return t('journal.unit.l', { amount: sized(value) });
  return formatNumber(value);
}

/** Where the counter stands among its tiers. */
export function journalPlace(id: JournalCounter, counts: JournalCounts): TierPlace {
  return tierPlace(counts[id], journalTiers(id));
}

/** The comparison of the tier the counter reached, with its number in it where the text has one. */
export function journalPhrase(id: JournalCounter, counts: JournalCounts): string {
  const value = counts[id];
  const { index } = journalPlace(id, counts);
  const key =
    id === 'flies' ? `journal.flies.phrase.${index}` : `journal.rows.${id}.phrase.${index}`;
  if (id === 'height') return t(key, { amount: journalAmount(id, value) });
  // The word agrees with the number printed, not with the exact litres.
  if (id === 'glaze') return tn(key, shown(value), { amount: sized(value) });
  return tn(key, value, { amount: formatNumber(value) });
}

/** The row title (`journal.rows.<id>.label`); the flies have the bar instead of a row. */
export function journalLabel(id: JournalRowId): string {
  return t(`journal.rows.${id}.label`);
}

/** The rank of the fly bar for the reached tier. */
export function fliesRank(counts: JournalCounts): string {
  return t(`journal.flies.rank.${journalPlace('flies', counts).index}`);
}

/**
 * The dish of the fly window: the reached one, or the glass below the first tier (the caption
 * then names the goal). Its index is 1..5 (glass, jar, pot, bucket, bathtub).
 */
export function fliesDish(counts: JournalCounts): { index: number; caption: string } {
  const index = Math.max(1, journalPlace('flies', counts).index);
  const from = JOURNAL.flies[index]?.from ?? 0;
  return { index, caption: t(`journal.flies.dish.${index}`, { amount: formatNumber(from) }) };
}

/** The text of a tier bar: "312 / 500", in the units of the counter; the top tier says so. */
export function journalBarText(id: JournalCounter, counts: JournalCounts): string {
  const { next } = journalPlace(id, counts);
  if (next === null) return t('journal.topTier');
  return `${journalAmount(id, counts[id])} / ${journalAmount(id, next)}`;
}
