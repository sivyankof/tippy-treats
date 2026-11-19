import type { NextCreature } from '../../../core/creatures/team-queue';
import { t, tn } from '../../../i18n';
import { pluralFormTexts } from '../common/glyph-layout';
import { numberGlyphTexts } from '../common/number-glyphs';

/** The words of the indicator: "now" on the creature layer, "in N layers" before it. */
export function nextCreatureLabel(next: Pick<NextCreature, 'inLayers'>): string {
  return next.inLayers === 0 ? t('run.nextCreatureNow') : tn('run.nextCreatureIn', next.inLayers);
}

/** The text pieces the label can be made of in the current language (every plural form, "now" and the numbers), for baking the glyphs ahead. */
export function nextLabelGlyphTexts(): string[] {
  return [
    ...pluralFormTexts(t('run.nextCreatureIn')),
    t('run.nextCreatureNow'),
    ...numberGlyphTexts(),
  ];
}

/** What the next-creature chip shows: the words or number (`null` for the icon alone) and whether the icon flashes. */
export interface NextChipContent {
  text: string | null;
  flash: boolean;
}

/**
 * The full chip says "now" or "in N layers". The compact one (3+ effect badges) shows the number of
 * layers away; on the creature layer itself it drops the number and flashes the icon instead.
 */
export function nextChipContent(
  next: Pick<NextCreature, 'inLayers'>,
  compact: boolean,
  formatCount: (n: number) => string,
): NextChipContent {
  if (!compact) return { text: nextCreatureLabel(next), flash: false };
  if (next.inLayers === 0) return { text: null, flash: true };
  return { text: formatCount(next.inLayers), flash: false };
}
