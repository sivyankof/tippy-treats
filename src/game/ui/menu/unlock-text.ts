import type { UnlockHint } from '../../../core/collection';
import { t } from '../../../i18n';

/**
 * The way to get a locked creature as plain text, or `null` for a shop price the player can
 * already pay with (the screen shows it as a price tag with a coin or berry icon).
 */
export function unlockText(hint: UnlockHint, bakerLevel: number): string | null {
  switch (hint.kind) {
    case 'shop':
      return bakerLevel >= hint.minBakerLevel
        ? null
        : t('unlock.bakerLevel', { n: hint.minBakerLevel });
    case 'bakerLevel':
      return t('unlock.bakerLevel', { n: hint.level });
    case 'record':
      return t('unlock.record', { n: hint.height });
    case 'streak':
      return t('unlock.streak', { n: hint.day });
    case 'starterPack':
      return t('unlock.starterPack');
    case 'tutorial':
      return t('unlock.tutorial');
  }
}
