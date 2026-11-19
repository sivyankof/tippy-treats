import { isMaster, masterInfo, upgradePreview } from '../../../core/creatures/mastery';
import type { CreatureId } from '../../../data/creatures/creatures';
import { formatDecimal, t } from '../../../i18n';
import { formatValues } from './detail-model';

/**
 * One line of the "what the next level gives" block and of the master block. The kinds set the
 * colour: `change` and `perk` green, `look` and `master` gold, `phrase` plain small text.
 */
export interface DetailRow {
  kind: 'change' | 'perk' | 'look' | 'master' | 'phrase';
  text: string;
}

/** The master effect of a creature as two rows: "Master: «Name»" and its one phrase. */
export function masterRows(id: CreatureId): DetailRow[] {
  const info = masterInfo(id);
  return [
    { kind: 'master', text: t('mastery.master', { name: t(info.nameKey) }) },
    { kind: 'phrase', text: t(info.shortKey, formatValues(info.values, formatDecimal)) },
  ];
}

/** What a level 5 creature shows under its ability. */
export function masterBlock(id: CreatureId, level: number): DetailRow[] {
  return isMaster(level) ? masterRows(id) : [];
}

/** Number changes of the next level as one labelled line each: "Tolerance: 38 → 39 px", the label and unit from i18n by creature and stat key. */
export function changeRows(
  id: CreatureId,
  changes: ReadonlyArray<readonly [string, number, number]>,
): DetailRow[] {
  return changes.map(([key, from, to]) => ({
    kind: 'change',
    text: t(`mastery.stat.${id}.${key}`, formatValues({ from, to }, formatDecimal)),
  }));
}

/**
 * What the next level gives, all from the core preview: the changed numbers, the new properties,
 * the new look and, on the step to the master level, the master effect. Empty at the maximum
 * level. The first row carries "Lv. N:" so the block reads as a promise of that level.
 */
export function upgradeRows(id: CreatureId, level: number): DetailRow[] {
  const preview = upgradePreview(id, level);
  if (!preview) return [];
  const rows: DetailRow[] = [];
  if (preview.changes.length > 0) {
    rows.push(...changeRows(id, preview.changes));
  }
  for (const perk of preview.perks) {
    rows.push({
      kind: 'perk',
      text: t(`mastery.perk.${perk.id}`, formatValues(perk.values, formatDecimal)),
    });
  }
  if (preview.newLook) rows.push({ kind: 'look', text: t('mastery.newLook') });
  if (preview.master) rows.push(...masterRows(preview.master));
  const [first] = rows;
  if (first) first.text = t('detail.nextLevel', { n: preview.toLevel, change: first.text });
  return rows;
}

/**
 * What the creature window leaves out, step by step, while the content does not fit a short
 * screen (docs/07, section 8): the trait line, the line about another way to get the creature,
 * the "Try" text button (it becomes an icon next to "To team"), the master phrase. Step 0 is the
 * full window. The next-level block, the upgrade button and its price never go.
 */
export interface DetailPlan {
  trait: boolean;
  otherWays: boolean;
  tryButton: 'text' | 'icon';
  masterPhrase: boolean;
}

export const DETAIL_PLAN_STEPS = 5;

export function detailPlan(step: number): DetailPlan {
  return {
    trait: step < 1,
    otherWays: step < 2,
    tryButton: step < 3 ? 'text' : 'icon',
    masterPhrase: step < 4,
  };
}
