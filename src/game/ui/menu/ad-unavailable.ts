import type * as Phaser from 'phaser';
import { t } from '../../../i18n';
import type { Button } from '../button';
import { fitText } from './fit-text';

/**
 * A rewarded-ad button while no ad can be shown: inactive, dimmed to `alpha` and labelled
 * "Ad unavailable" (docs/05-economy-monetization.md, section 6). With `disable` false the button
 * only looks so and still takes a tap (the caller looks at the ad again then).
 */
export function markAdUnavailable(
  button: Button,
  label: Phaser.GameObjects.Text,
  maxWidth: number,
  alpha: number,
  disable = true,
): void {
  label.setText(t('continue.adUnavailable'));
  fitText(label, maxWidth);
  if (disable) button.setEnabled(false);
  button.setAlpha(alpha);
}
