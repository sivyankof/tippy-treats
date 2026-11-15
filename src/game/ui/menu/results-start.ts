import type * as Phaser from 'phaser';
import type { CheckpointHeight, CheckpointMethod } from '../../../core/checkpoints';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import type { ResultsData } from '../../scene-keys';
import { createTextButton, type Button } from '../button';
import { BalanceChip, followBalance } from '../style/balance-chip';
import { createPriceButton } from '../style/price-button';
import { createAdsSpentNote } from './no-more-starts-note';
import { markAdUnavailable } from './ad-unavailable';
import type { ResultsHeader } from './results-header';
import type { Row } from './results-layout';
import { resultsStartPlan, type ResultsStartPlan } from './results-start-model';
import { openStartChoice, payAndStart, type StartRun } from './start-choice';
import { createStartFromButton } from './start-from-button';

const cfg = MENU.results;
const pair = cfg.pairButton;
const pairLabelWidth = pair.width - cfg.buttonTextPadding;

/** Buttons that sit between "Play again" and "Home" and the rows they make. */
export interface ExtraButtons {
  rows: Row[];
  setEnabled(enabled: boolean): void;
}

export interface ResultsStartHooks {
  /** Leaves the results into a run (the same way "Play again" does). */
  start: StartRun;
  /** The screen is leaving: nothing starts. */
  leaving: () => boolean;
}

/**
 * The checkpoint buttons of the results (docs/07-ui-screens.md, section 6): after a checkpoint run
 * the same start again for berries and, for a low one, for an ad; after a zero start a small button
 * that opens the "Where from?" window.
 */
export class ResultsStart implements ExtraButtons {
  readonly rows: Row[] = [];
  private readonly buttons: Button[] = [];
  private ad: { button: Button; label: Phaser.GameObjects.Text } | null = null;
  private adGrey = false;
  private chip: BalanceChip | null = null;
  private paying = false;

  constructor(
    private readonly scene: Phaser.Scene,
    plan: ResultsStartPlan,
    header: ResultsHeader,
    private readonly hooks: ResultsStartHooks,
  ) {
    if (plan.kind === 'choose') this.addChoose();
    if (plan.kind === 'again') this.addAgain(plan, header);
  }

  setEnabled(enabled: boolean): void {
    for (const button of this.buttons) button.setEnabled(enabled);
    if (this.ad && this.adGrey) this.ad.button.setEnabled(false);
  }

  private addChoose(): void {
    const button = createStartFromButton(this.scene, cfg.startFrom, 'ui_results_from', () => {
      if (!this.hooks.leaving()) openStartChoice(this.scene, this.hooks.start);
    });
    this.buttons.push(button);
    this.rows.push({ obj: button, height: cfg.startFrom.height });
  }

  private addAgain(
    plan: Extract<ResultsStartPlan, { kind: 'again' }>,
    header: ResultsHeader,
  ): void {
    const { height, main } = plan;
    // The balance stands on the ribbon row, so the player sees what the start costs them.
    this.chip = header.addBalance();
    followBalance(this.scene, this.chip, this.chip.root, () => gameState.berries);
    const withAd = plan.ad !== 'hidden';
    const layout = withAd ? pair : cfg.homeButton;
    const price = createPriceButton(this.scene, {
      template: t('results.fromPointFor', { n: height }),
      price: main.price,
      have: main.price - main.missing,
      currency: 'berries',
      fill: PALETTE.accentSecondary,
      layout,
      font: layout.font,
      maxWidth: layout.width - cfg.buttonTextPadding,
      keyPrefix: withAd ? 'ui_results_pair' : 'ui_results_home',
      onPay: () => void this.pay(height, 'berries'),
      onShort: () => this.chip?.shake(),
    });
    this.buttons.push(price);
    if (!withAd) {
      if (!plan.adSpent) {
        this.rows.push({ obj: price, height: layout.height });
        return;
      }
      // The caption hangs under the price button, in the same row.
      const note = createAdsSpentNote(this.scene, 0, 0, cfg.panel.width - cfg.buttonTextPadding);
      const total = layout.height + note.height + cfg.rowGap;
      const box = this.scene.add.container(0, 0, [price, note]);
      price.setY(-total / 2 + layout.height / 2);
      note.setY(total / 2 - note.height / 2);
      this.rows.push({ obj: box, height: total });
      return;
    }
    const { button, label } = createTextButton(this.scene, {
      text: t('results.fromPointAd', { n: height }),
      font: pair.font,
      maxLabelWidth: pairLabelWidth,
      fill: PALETTE.accentSecondary,
      layout: pair,
      keyPrefix: 'ui_results_pair',
      onClick: () => void this.pay(height, 'ad'),
    });
    this.ad = { button, label };
    this.buttons.push(button);
    if (plan.ad === 'unavailable') this.greyAd();
    const shift = (pair.width + cfg.pairGap) / 2;
    price.setX(-shift);
    button.setX(shift);
    this.rows.push({ obj: this.scene.add.container(0, 0, [price, button]), height: pair.height });
  }

  private greyAd(): void {
    if (!this.ad) return;
    this.adGrey = true;
    markAdUnavailable(this.ad.button, this.ad.label, pairLabelWidth, cfg.adDisabledAlpha);
  }

  private async pay(height: CheckpointHeight, method: CheckpointMethod): Promise<void> {
    if (this.paying || this.hooks.leaving()) return;
    this.paying = true;
    const result = await payAndStart(height, method, this.hooks.start);
    this.paying = false;
    if (result === 'short') this.chip?.shake();
    if (method === 'ad' && (result === 'unavailable' || result === 'refused')) this.greyAd();
  }
}

/** The start buttons for the run on screen (none when the run offers no checkpoint start). */
export function createResultsStart(
  scene: Phaser.Scene,
  data: ResultsData,
  header: ResultsHeader,
  hooks: ResultsStartHooks,
): ResultsStart {
  const plan = resultsStartPlan({
    daily: data.result.mode === 'daily',
    firstRun: data.summary.firstRun,
    recorded: data.recorded,
    checkpoint: data.checkpoint,
    opened: gameState.checkpoints,
    rows: gameState.checkpointRows(services.ads.isRewardedReady()),
  });
  return new ResultsStart(scene, plan, header, hooks);
}
