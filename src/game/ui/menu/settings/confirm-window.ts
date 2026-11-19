import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { createTextButton } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';

const cfg = MENU.confirm;

export interface ConfirmOptions {
  title: string;
  /** The question, wrapped to the window. */
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Colour of the confirm button. */
  confirmFill: number;
  /** Runs once the window has started to close. */
  onConfirm: () => void;
}

/**
 * A window with a question and two buttons one under the other: cancel (also the close button
 * and the veil) on top, the confirming one under it.
 */
export function openConfirmWindow(scene: Phaser.Scene, options: ConfirmOptions): PopupWindow {
  const popup = new PopupWindow(scene, { title: options.title });
  const text = createOutlinedText(scene, 0, 0, options.text, cfg.textFont)
    .setOrigin(0.5, 0)
    .setAlign('center')
    .setWordWrapWidth(popup.innerWidth);
  const rowY = (row: number): number =>
    text.height + cfg.textGap + cfg.button.height / 2 + row * (cfg.button.height + cfg.buttonGap);
  const button = (label: string, fill: number, row: number, onClick: () => void) =>
    createTextButton(scene, {
      text: label,
      font: cfg.button.font,
      maxLabelWidth: cfg.button.width - cfg.button.radius * 2,
      fill,
      layout: cfg.button,
      keyPrefix: 'ui_confirm_button',
      y: rowY(row),
      onClick,
    }).button;
  const cancel = button(options.cancelLabel, PALETTE.success, 0, popup.close);
  const confirm = button(options.confirmLabel, options.confirmFill, 1, () => {
    cancel.setEnabled(false);
    confirm.setEnabled(false);
    popup.close();
    options.onConfirm();
  });
  popup.content.add([text, cancel, confirm]);
  popup.setContentHeight(rowY(1) + cfg.button.height / 2);
  return popup;
}
