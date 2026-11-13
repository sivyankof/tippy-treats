import type * as Phaser from 'phaser';
import { TOGGLE_BUTTON } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import type { Button } from './button';
import { createLabelButton } from './button';
import { createOutlinedText } from './outlined-text';

/** A button that flips an on/off setting and shows its state in the label. */
export class ToggleButton {
  readonly button: Button;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly nameKey: string,
    private readonly read: () => boolean,
    private readonly write: (on: boolean) => void,
  ) {
    this.label = createOutlinedText(scene, 0, 0, '', TOGGLE_BUTTON.font);
    this.button = createLabelButton(
      scene,
      0,
      0,
      this.label,
      PALETTE.accentSecondary,
      TOGGLE_BUTTON,
      'ui_toggle_button',
      () => {
        this.write(!this.read());
        this.refresh();
      },
    );
    this.refresh();
  }

  /** Shows the current state of the setting. */
  refresh(): void {
    const on = this.read();
    const state = t(on ? 'run.on' : 'run.off');
    this.label.setText(t('run.toggle', { name: t(this.nameKey), state }));
    // Only the label dims: the face stays opaque over whatever is behind the overlay.
    this.label.setAlpha(on ? 1 : TOGGLE_BUTTON.offAlpha);
  }
}
