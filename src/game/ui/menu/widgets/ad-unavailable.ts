import * as Phaser from 'phaser';
import {
  AD_UNAVAILABLE_CAPTION,
  OFFLINE_CAPTION_LAYOUT,
} from '../../../../data/economy/offline-look';
import { VIDEO_CAPTION_LAYOUT } from '../../../../data/economy/video-icon-look';
import { cssColor } from '../../../../util/color';
import { t } from '../../../../i18n';
import { currentAdCaption } from '../../../economy/ad-caption';
import {
  OFFLINE_ICON_FIELD_SCALE,
  OFFLINE_ICON_KEY,
  bakeOfflineIcon,
} from '../../../fx/economy/offline-icon-texture';
import {
  VIDEO_ICON_FIELD_SCALE,
  VIDEO_ICON_KEY,
  bakeVideoIcon,
} from '../../../fx/economy/video-icon-texture';
import type { Button } from '../../common/button';
import { fitText, onFontRefresh } from './fit-text';

const ICON_KEY = 'offlineIcon';
const VIDEO_KEY = 'videoIcon';
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

function iconOf(label: Phaser.GameObjects.Text, key: string): Phaser.GameObjects.Image | null {
  const icon: unknown = label.getData(key);
  return icon instanceof Phaser.GameObjects.Image ? icon : null;
}

/** The icon of `key` on a label, made on first use beside it in its container. */
function ensureIcon(
  label: Phaser.GameObjects.Text,
  key: string,
  texture: string,
): Phaser.GameObjects.Image {
  let icon = iconOf(label, key);
  if (!icon) {
    icon = label.scene.add.image(0, 0, texture);
    label.parentContainer?.add(icon);
    label.setData(key, icon);
  }
  return icon;
}

/** The widest icon-and-caption pair a rewarded button of `buttonWidth` takes: `edgePad` stays free on each side. */
export function adLabelRoom(buttonWidth: number): number {
  return buttonWidth - VIDEO_CAPTION_LAYOUT.edgePad * 2;
}

/** Shows `icon` left of the text, the pair centred on the label's spot and fitted to `maxWidth`. */
function layoutWithIcon(
  label: Phaser.GameObjects.Text,
  icon: Phaser.GameObjects.Image,
  look: { sizeShare: number; gapShare: number },
  fieldScale: number,
  maxWidth: number,
): void {
  const side = label.height * look.sizeShare;
  const gap = side * look.gapShare;
  icon.setDisplaySize(side * fieldScale, side * fieldScale).setVisible(true);
  label.setX(0);
  const room = maxWidth - side - gap;
  fitText(label, room);
  // `fitText` stops at its own minimum; the edge room of the button holds whatever the text needs.
  if (label.displayWidth > room) label.setScale(room / label.width);
  const total = side + gap + label.displayWidth;
  icon.setPosition(-total / 2 + side / 2, label.y);
  label.setX(-total / 2 + side + gap + label.displayWidth / 2);
}

/** A plain one-line label: no icon, centred, fitted to `maxWidth` (a button whose ad is spent: "Doubled"). */
export function plainAdLabel(label: Phaser.GameObjects.Text, maxWidth: number): void {
  iconOf(label, ICON_KEY)?.setVisible(false);
  iconOf(label, VIDEO_KEY)?.setVisible(false);
  label.setX(0);
  fitText(label, maxWidth);
}

/**
 * The label of a rewarded-video button that can be pressed: the shared video icon left of the
 * text (the same picture on every such button), usual colours, fitted to `maxWidth`. Call it again
 * after the text changes.
 */
export function resetAdLabel(label: Phaser.GameObjects.Text, maxWidth: number): void {
  restoreLabel(label);
  iconOf(label, ICON_KEY)?.setVisible(false);
  bakeVideoIcon(label.scene);
  const icon = ensureIcon(label, VIDEO_KEY, VIDEO_ICON_KEY);
  layoutWithIcon(label, icon, VIDEO_CAPTION_LAYOUT, VIDEO_ICON_FIELD_SCALE, maxWidth);
  // A late font load re-fits the text; lay the icon out again around it.
  onFontRefresh(label, () => resetAdLabel(label, maxWidth));
}

/** The label of an unavailable ad button: the caption for the current reason, with an icon when offline. */
export function showAdCaption(label: Phaser.GameObjects.Text, maxWidth: number): void {
  const caption = currentAdCaption();
  darkenLabel(label);
  label.setText(t(caption.key));
  iconOf(label, VIDEO_KEY)?.setVisible(false);
  if (!caption.offline) {
    plainAdLabel(label, maxWidth);
    return;
  }
  bakeOfflineIcon(label.scene);
  const icon = ensureIcon(label, ICON_KEY, OFFLINE_ICON_KEY);
  layoutWithIcon(label, icon, OFFLINE_CAPTION_LAYOUT, OFFLINE_ICON_FIELD_SCALE, maxWidth);
  onFontRefresh(label, () => showAdCaption(label, maxWidth));
}

/**
 * A rewarded-ad button while no ad can be shown: inactive, its plate dimmed to `alpha` (the caption and icon stay at full opacity) and labelled
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
  button.setPlateAlpha(alpha);
}
