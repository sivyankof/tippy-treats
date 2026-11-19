import { formatNumber } from '../../../i18n';

/** Every character `formatNumber` can write in the current language: the digits and the group separator. */
export function numberGlyphTexts(): string[] {
  return ['0123456789', formatNumber(1234567)];
}
