import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { PAUSE } from '../../../data/run/hud-layout';
import { PALETTE } from '../../../data/common/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button } from '../common/button';
import { createToggleRows, soundSettingRows } from '../menu/settings/setting-toggles';
import { GlyphText, prepareGlyphs } from '../common/glyph-text';
import { COUNTDOWN_DIGITS, COUNTDOWN_GLYPH_STYLE } from './run-volume-styles';
import { PopupWindow } from '../style/dialog-window';
import type { ToggleSwitch } from '../style/toggle-switch';
import { leaveScreen } from '../common/transition';

const btn = PAUSE.button;

export interface PauseHandlers {
  /** Called after the 3-2-1 countdown: the run may go on. */
  onResume: () => void;
  /** Called once the window has left and the screen is dark. */
  onRestart: () => void;
  /** Leave the run for the screen it came from; called once the screen is dark. */
  onHome: () => void;
}

/**
 * Pause window of the kit (`PopupWindow`): Continue (with a 3-2-1 countdown over the run),
 * Restart, Home and the sound, music, vibration and "fewer effects" switches.
 */
export class PauseOverlay {
  private readonly countdown: GlyphText;
  private popup: PopupWindow | null = null;
  private controls: Array<Button | ToggleSwitch> = [];
  private countdownTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {
    // The digits are baked now, with the HUD, so the countdown over the paused run bakes nothing.
    prepareGlyphs(scene, COUNTDOWN_GLYPH_STYLE, [COUNTDOWN_DIGITS]);
    this.countdown = new GlyphText(scene, 0, 0, COUNTDOWN_GLYPH_STYLE, 0.5, 0.5, 1)
      .setDepth(PAUSE.countdownDepth)
      .setVisible(false);
  }

  /** The window or its countdown is up: the run waits and takes no taps. */
  get visible(): boolean {
    return this.popup !== null || this.countdownTimer !== null;
  }

  /** The window covers the whole canvas, the insets too (`PopupWindow` stands on the canvas whatever the camera scroll). */
  show(): void {
    this.cancelCountdown();
    this.popup?.destroy();
    this.build();
  }

  private build(): void {
    const popup = new PopupWindow(this.scene, {
      title: t('run.paused'),
      closable: false,
      back: 'pass',
      closeOnVeil: false,
    });
    const button = (text: string, fill: number, row: number, onClick: () => void): Button =>
      createTextButton(this.scene, {
        text,
        font: btn.font,
        maxLabelWidth: btn.width - PAUSE.labelPad,
        fill,
        layout: btn,
        keyPrefix: 'ui_pause_button',
        y: btn.height / 2 + row * (btn.height + PAUSE.buttonGap),
        onClick,
      }).button;
    const buttons = [
      button(t('run.resume'), PALETTE.accent, 0, () => this.beginCountdown()).breathe(),
      button(t('run.restart'), PALETTE.accentSecondary, 1, () =>
        this.leave(this.handlers.onRestart),
      ),
      button(t('run.home'), PALETTE.success, 2, () => this.leave(this.handlers.onHome)),
    ];
    const togglesTop = buttons.length * (btn.height + PAUSE.buttonGap) + PAUSE.togglesTop;
    const { toggles, bottom } = createToggleRows(this.scene, soundSettingRows(), {
      x: 0,
      top: togglesTop,
      width: btn.width,
    });
    popup.content.add([...buttons, ...toggles]);
    popup.setContentHeight(bottom);
    this.popup = popup;
    this.controls = [...buttons, ...toggles];
  }

  /**
   * The Android back while the pause shows: the window closes as by "Resume" (the 3-2-1 count
   * follows); during the count it is taken and nothing else happens. False when nothing shows.
   */
  back(): boolean {
    if (this.countdownTimer !== null) return true;
    if (!this.popup) return false;
    // While the window slides away to a new run or home, its controls are off: the back waits.
    if (this.controls.some((control) => control.input?.enabled)) this.beginCountdown();
    return true;
  }

  /** Takes the window and the countdown away at once. */
  hide(): void {
    this.cancelCountdown();
    this.countdown.setVisible(false);
    this.popup?.destroy();
    this.popup = null;
    this.controls = [];
  }

  layout(width: number, height: number): void {
    this.countdown.setPosition(width / 2, height / 2);
  }

  private disableControls(): void {
    for (const control of this.controls) control.setEnabled(false);
  }

  /** The window slides away and the screen darkens before the new run (or the next screen) starts. */
  private leave(then: () => void): void {
    if (!this.popup) return;
    this.disableControls();
    leaveScreen(this.scene, [this.popup.frame], then);
  }

  /** The window shrinks away and 3-2-1 counts down over the run. */
  private beginCountdown(): void {
    if (!this.popup) return;
    this.disableControls();
    this.popup.close();
    this.popup = null;
    this.controls = [];
    this.countdown.setVisible(true);
    this.tick(ANIM.hud.countdownSteps);
  }

  private tick(remaining: number): void {
    if (remaining === 0) {
      this.hide();
      this.handlers.onResume();
      return;
    }
    this.countdown.setText(String(remaining));
    this.countdownTimer = this.scene.time.delayedCall(ANIM.hud.countdownStepMs, () =>
      this.tick(remaining - 1),
    );
  }

  private cancelCountdown(): void {
    this.countdownTimer?.remove(false);
    this.countdownTimer = null;
  }
}
