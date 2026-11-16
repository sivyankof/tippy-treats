import * as Phaser from 'phaser';
import { AD_UNAVAILABLE_CAPTION, OFFLINE_CAPTION_LAYOUT } from '../../../data/offline-look';
import { cssColor } from '../../../util/color';
import { t } from '../../../i18n';
import { currentAdCaption } from '../../ad-caption';
import { OFFLINE_ICON_KEY, bakeOfflineIcon } from '../../fx/offline-icon-texture';
import type { Button } from '../button';
import { fitText, onFontRefresh } from './fit-text';

const ICON_KEY = 'offlineIcon';
const STYLE_KEY = 'adLabelStyle';

interface SavedStyle {
  color: string | CanvasGradient | CanvasPattern;
  stroke: string | CanvasGradient | CanvasPattern;
  strokeThickness: number;
  shadowOffsetY: number;
  shadowColor: string;
  shadowStroke: boolean;
  shadowFill: boolean;
}

/** Puts the caption in the dark plum of an unavailable button; the usual style is kept to give back. */
function darkenLabel(label: Phaser.GameObjects.Text): void {
  const style = label.style;
  if (label.getData(STYLE_KEY) === undefined) {
    const saved: SavedStyle = {
      color: style.color,
      stroke: style.stroke,
      strokeThickness: style.strokeThickness,
      shadowOffsetY: style.shadowOffsetY,
      shadowColor: style.shadowColor,
      shadowStroke: style.shadowStroke,
      shadowFill: style.shadowFill,
    };
    label.setData(STYLE_KEY, saved);
  }
  label
    .setColor(cssColor(AD_UNAVAILABLE_CAPTION.color))
    .setStroke(cssColor(AD_UNAVAILABLE_CAPTION.stroke), style.strokeThickness)
    .setShadow(0, 0, cssColor(AD_UNAVAILABLE_CAPTION.color), 0, false, false);
}

function restoreLabel(label: Phaser.GameObjects.Text): void {
  const saved = label.getData(STYLE_KEY) as SavedStyle | undefined;
  if (!saved) return;
  label.setData(STYLE_KEY, undefined);
  label
    .setColor(saved.color)
    .setStroke(saved.stroke, saved.strokeThickness)
    .setShadow(0, saved.shadowOffsetY, saved.shadowColor, 0, saved.shadowStroke, saved.shadowFill);
}

function iconOf(label: Phaser.GameObjects.Text): Phaser.GameObjects.Image | null {
  const icon: unknown = label.getData(ICON_KEY);
  return icon instanceof Phaser.GameObjects.Image ? icon : null;
}

/** Puts the caption back to a plain one-line label: no icon, centred, fitted to `maxWidth`. */
export function resetAdLabel(label: Phaser.GameObjects.Text, maxWidth: number): void {
  iconOf(label)?.setVisible(false);
  restoreLabel(label);
  label.setX(0);
  fitText(label, maxWidth);
}

/** The label of an unavailable ad button: the caption for the current reason, with an icon when offline. */
export function showAdCaption(label: Phaser.GameObjects.Text, maxWidth: number): void {
  const caption = currentAdCaption();
  darkenLabel(label);
  label.setText(t(caption.key));
  if (!caption.offline) {
    resetAdLabel(label, maxWidth);
    return;
  }
  bakeOfflineIcon(label.scene);
  let icon = iconOf(label);
  if (!icon) {
    icon = label.scene.add.image(0, 0, OFFLINE_ICON_KEY);
    label.parentContainer?.add(icon);
    label.setData(ICON_KEY, icon);
  }
  const side = label.height * OFFLINE_CAPTION_LAYOUT.sizeShare;
  const gap = side * OFFLINE_CAPTION_LAYOUT.gapShare;
  icon.setDisplaySize(side, side).setVisible(true);
  label.setX(0);
  fitText(label, maxWidth - side - gap);
  const total = side + gap + label.displayWidth;
  icon.setPosition(-total / 2 + side / 2, label.y);
  label.setX(-total / 2 + side + gap + label.displayWidth / 2);
  // A late font load re-fits the text; lay the icon out again around it.
  onFontRefresh(label, () => showAdCaption(label, maxWidth));
}

/**
 * A rewarded-ad button while no ad can be shown: inactive, dimmed to `alpha` and labelled
 * "Ad unavailable", or "No internet" with a small icon when the reason is no network
 * (docs/05-economy-monetization.md, section 6). With `disable` false the button only looks so
 * and still takes a tap (the caller looks at the ad again then).
 */
export function markAdUnavailable(
  button: Button,
  label: Phaser.GameObjects.Text,
  maxWidth: number,
  alpha: number,
  disable = true,
): void {
  showAdCaption(label, maxWidth);
  if (disable) button.setEnabled(false);
  button.setAlpha(alpha);
}
