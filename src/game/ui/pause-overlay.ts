import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { MENU_BUTTON, TOGGLE_BUTTON } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { services } from '../../services';
import { setReducedFxOn, setSoundOn, setVibrationOn } from '../apply-settings';
import { effectsMode } from '../effects-mode';
import { createMenuButton, type Button } from './button';
import { createDimOverlay } from './dim-overlay';
import { createOutlinedText } from './outlined-text';
import { ToggleButton } from './toggle-button';
import { leaveScreen, openPopup } from './transition';

const OVERLAY_DEPTH = 500;
const TITLE_FONT = 120;
const COUNTDOWN_FONT = 320;
const TITLE_OFFSET = -440;
const CONTINUE_OFFSET = -160;
const MENU_STEP = MENU_BUTTON.height + 40;
const RESTART_OFFSET = CONTINUE_OFFSET + MENU_STEP;
const HOME_OFFSET = RESTART_OFFSET + MENU_STEP;
const FIRST_TOGGLE_OFFSET = HOME_OFFSET + MENU_BUTTON.height + TOGGLE_BUTTON.gap;
const TOGGLE_STEP = TOGGLE_BUTTON.height + TOGGLE_BUTTON.gap / 2;

export interface PauseHandlers {
  /** Called after the 3-2-1 countdown: the run may go on. */
  onResume: () => void;
  /** Called once the window has left and the screen is dark. */
  onRestart: () => void;
  /** Leave the run for the screen it came from; called once the screen is dark. */
  onHome: () => void;
}

/**
 * Pause window: Continue (with a countdown), Restart, Home and the sound, vibration and
 * "fewer effects" switches. Everything but the dim veil
 * sits in `panel`, centred on the screen, so the window pops open around its centre.
 */
export class PauseOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly buttons: Button[];
  private readonly toggles: ToggleButton[];
  private countdownTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {
    this.dim = createDimOverlay(scene, ANIM.hud.pauseOverlayAlpha, 1, 1);
    this.title = createOutlinedText(scene, 0, TITLE_OFFSET, t('run.paused'), TITLE_FONT);
    this.countdown = createOutlinedText(scene, 0, 0, '', COUNTDOWN_FONT, PALETTE.gold).setVisible(
      false,
    );
    const continueButton = createMenuButton(
      scene,
      0,
      CONTINUE_OFFSET,
      t('run.resume'),
      PALETTE.accent,
      () => this.beginCountdown(),
    );
    const restartButton = createMenuButton(
      scene,
      0,
      RESTART_OFFSET,
      t('run.restart'),
      PALETTE.accentSecondary,
      () => this.leave(this.handlers.onRestart),
    );
    const homeButton = createMenuButton(scene, 0, HOME_OFFSET, t('run.home'), PALETTE.success, () =>
      this.leave(this.handlers.onHome),
    );
    this.toggles = [
      new ToggleButton(scene, 'run.sounds', () => services.audio.enabled, setSoundOn),
      new ToggleButton(scene, 'run.vibration', () => services.haptics.enabled, setVibrationOn),
      new ToggleButton(scene, 'run.reducedFx', () => effectsMode.reduced, setReducedFxOn),
    ];
    this.toggles.forEach((toggle, i) => toggle.button.setY(FIRST_TOGGLE_OFFSET + i * TOGGLE_STEP));
    this.buttons = [
      continueButton,
      restartButton,
      homeButton,
      ...this.toggles.map((toggle) => toggle.button),
    ];

    this.panel = scene.add.container(0, 0, [this.title, this.countdown, ...this.buttons]);
    this.root = scene.add
      .container(0, 0, [this.dim, this.panel])
      .setDepth(OVERLAY_DEPTH)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(): void {
    this.cancelCountdown();
    for (const toggle of this.toggles) toggle.refresh();
    this.showMenu(true);
    this.root.setVisible(true);
    this.dim.setInteractive();
    openPopup(this.scene, this.dim, this.panel);
  }

  hide(): void {
    this.cancelCountdown();
    this.root.setVisible(false);
    this.dim.disableInteractive();
  }

  layout(width: number, height: number): void {
    this.dim.setSize(width, height);
    this.panel.setPosition(width / 2, height / 2);
  }

  private showMenu(menu: boolean): void {
    this.title.setVisible(menu);
    for (const button of this.buttons) button.setVisible(menu).setEnabled(menu);
    this.countdown.setVisible(!menu);
  }

  /** The window slides away and the screen darkens before the new run (or the next screen) starts. */
  private leave(then: () => void): void {
    for (const button of this.buttons) button.setEnabled(false);
    leaveScreen(this.scene, [this.panel], then);
  }

  private beginCountdown(): void {
    this.showMenu(false);
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
