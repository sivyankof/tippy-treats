import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { createTextButton, type Button, type LabelButtonLayout } from '../../common/button';
import { stackRows, type Row } from './results-layout';
import type { ExtraButtons } from './results-start';

const cfg = MENU.results;

/** Label keys of the two buttons; the classic results use "Play again" and "Home". */
export interface ResultsButtonLabels {
  primary: string;
  home: string;
}

export interface ResultsButtonHandlers {
  /** "Play again", or "Next" after the tutorial run. */
  primary: () => void;
  home: () => void;
  /** The "Share" button next to "Home"; none when the run cannot be shared. */
  share?: () => void;
}

/** The big "Play again" (or "Next" after the tutorial) and the small "Home" under it. */
export class ResultsButtons {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly buttons: Button[] = [];
  private enabled = false;
  private readonly back: () => void;

  constructor(
    scene: Phaser.Scene,
    firstRun: boolean,
    handlers: ResultsButtonHandlers,
    labels: ResultsButtonLabels = { primary: 'run.playAgain', home: 'results.home' },
    private readonly extra: ExtraButtons | null = null,
  ) {
    this.container = scene.add.container(0, 0);
    // The Android back is "Home"; after the tutorial run, where there is none, it is "Next".
    this.back = firstRun ? handlers.primary : handlers.home;
    const make = (
      text: string,
      fill: number,
      layout: LabelButtonLayout & { font: number },
      key: string,
      onClick: () => void,
    ): Button => {
      const { button } = createTextButton(scene, {
        text,
        font: layout.font,
        maxLabelWidth: layout.width - cfg.buttonTextPadding,
        fill,
        layout,
        keyPrefix: key,
        onClick,
      });
      this.buttons.push(button);
      return button;
    };
    const primary = make(
      t(firstRun ? 'results.next' : labels.primary),
      PALETTE.accent,
      cfg.playButton,
      'ui_results_play',
      handlers.primary,
    ).breathe();
    const rows: Row[] = [{ obj: primary, height: cfg.playButton.height }];
    if (this.extra) rows.push(...this.extra.rows);
    if (!firstRun) {
      const { share } = handlers;
      const layout = share ? cfg.pairButton : cfg.homeButton;
      const home = make(
        t(labels.home),
        PALETTE.accentSecondary,
        layout,
        share ? 'ui_results_pair' : 'ui_results_home',
        handlers.home,
      );
      if (share) {
        const shift = (cfg.pairButton.width + cfg.pairGap) / 2;
        const shareButton = make(
          t('results.share'),
          PALETTE.accentSecondary,
          cfg.pairButton,
          'ui_results_pair',
          share,
        );
        home.setX(-shift);
        shareButton.setX(shift);
        const pair = scene.add.container(0, 0, [home, shareButton]);
        rows.push({ obj: pair, height: cfg.pairButton.height });
      } else {
        rows.push({ obj: home, height: cfg.homeButton.height });
      }
    }
    this.height = stackRows(this.container, rows, cfg.buttonGap);
  }

  /** The screen is about to show: the ad buttons look at the ads again. */
  refreshAd(): void {
    this.extra?.refreshAd();
  }

  /** The Android back: "Home" once the buttons are on; before that it is taken and nothing happens. */
  pressBack(): boolean {
    if (this.enabled) {
      this.setEnabled(false);
      this.back();
    }
    return true;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const button of this.buttons) button.setEnabled(enabled);
    this.extra?.setEnabled(enabled);
  }
}
