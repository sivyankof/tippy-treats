import type * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { createTextButton, type Button, type LabelButtonLayout } from '../button';
import { stackRows, type Row } from './results-layout';

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
}

/** The big "Play again" (or "Next" after the tutorial) and the small "Home" under it. */
export class ResultsButtons {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly buttons: Button[] = [];

  constructor(
    scene: Phaser.Scene,
    firstRun: boolean,
    handlers: ResultsButtonHandlers,
    labels: ResultsButtonLabels = { primary: 'run.playAgain', home: 'results.home' },
  ) {
    this.container = scene.add.container(0, 0);
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
    if (!firstRun) {
      const home = make(
        t(labels.home),
        PALETTE.accentSecondary,
        cfg.homeButton,
        'ui_results_home',
        handlers.home,
      );
      rows.push({ obj: home, height: cfg.homeButton.height });
    }
    this.height = stackRows(this.container, rows, cfg.buttonGap);
  }

  setEnabled(enabled: boolean): void {
    for (const button of this.buttons) button.setEnabled(enabled);
  }
}
