import type * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { t } from '../../../i18n';
import { createTextButton } from '../common/button';
import { createOutlinedText } from '../common/outlined-text';
import { PopupWindow } from '../style/dialog-window';

/** Where the parts of an explainer window sit, by their centres from the top of the content. */
export interface ExplainerLayout {
  contentHeight: number;
  pictureY: number;
  textY: number;
  font: number;
  buttonY: number;
  button: { width: number; height: number; radius: number; shadowOffset: number; font: number };
}

export interface ExplainerOptions {
  title: string;
  /** The picture on top; it is placed at `layout.pictureY`. */
  picture: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
  text: string;
  /** Left keeps a list of lines readable; the block itself stays centred. Default centre. */
  align?: 'center' | 'left';
  lineSpacing?: number;
  layout: ExplainerLayout;
  keyPrefix: string;
  onClosed?: () => void;
}

/** A one-time explainer: a picture, a few lines of text and the "Got it!" button. */
export function openExplainerWindow(scene: Phaser.Scene, options: ExplainerOptions): PopupWindow {
  const { layout } = options;
  const popup = new PopupWindow(scene, {
    title: options.title,
    contentHeight: layout.contentHeight,
    onClosed: options.onClosed,
  });
  options.picture.setPosition(0, layout.pictureY);
  popup.content.add(options.picture);
  const line = createOutlinedText(
    scene,
    0,
    layout.textY,
    options.text,
    layout.font,
    PALETTE.textLight,
  );
  line
    .setWordWrapWidth(popup.innerWidth, true)
    .setAlign(options.align ?? 'center')
    .setLineSpacing(options.lineSpacing ?? 0);
  popup.content.add(line);
  const ok = createTextButton(scene, {
    text: t('explainer.ok'),
    font: layout.button.font,
    maxLabelWidth: layout.button.width - layout.button.radius * 2,
    fill: PALETTE.accent,
    layout: layout.button,
    keyPrefix: options.keyPrefix,
    x: 0,
    y: layout.buttonY,
    onClick: popup.close,
  });
  popup.content.add(ok.button);
  return popup;
}
