import type * as Phaser from 'phaser';
import type { CheckpointMethod, CheckpointRow } from '../../../core/checkpoints';
import { CHECKPOINT_WINDOW } from '../../../data/checkpoint-look';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import { bakeCheckpointTextures } from '../../fx/checkpoint-textures';
import { createTextButton, type Button } from '../button';
import { BalanceChip, followBalance } from '../style/balance-chip';
import { PopupWindow } from '../style/dialog-window';
import { createPriceButton } from '../style/price-button';
import { markAdUnavailable } from './ad-unavailable';
import { buttonsFor, keepSelection, type StartHeight } from './checkpoint-model';
import { createCheckpointStep } from './checkpoint-step';

const cfg = CHECKPOINT_WINDOW;
const button = MENU.wideButton;
const labelWidth = button.width - button.radius * 2;

export interface CheckpointWindowOptions {
  /** The free start first, then every checkpoint, lowest first (`checkpointRows`). */
  rows: CheckpointRow[];
  berries: number;
  /**
   * A button was pressed. While the promise is pending every button is locked. `started` closes the
   * window (without `onClose`), `stay` keeps it; the caller may `refresh` it.
   */
  onChoose(height: StartHeight, method: 'free' | CheckpointMethod): Promise<'started' | 'stay'>;
  /** The window was closed without a start (the cross, the veil, back). */
  onClose?(): void;
}

export interface CheckpointWindow {
  /** New rows and balance: the selection stays when its step is still open. */
  refresh(rows: CheckpointRow[], berries: number): void;
  close(): void;
}

/**
 * The "Where from?" window (docs/07-ui-screens.md, section 2.1): the starts as the steps of a
 * climb (the free one at the bottom, layer 100 at the top). The selected step is played with the
 * button under the stairs, for berries, or for an ad when the step has one.
 */
export function openCheckpointWindow(
  scene: Phaser.Scene,
  options: CheckpointWindowOptions,
): CheckpointWindow {
  bakeCheckpointTextures(scene);
  let rows = options.rows;
  let berries = options.berries;
  let selected: StartHeight = 0;
  let busy = false;
  let started = false;
  let gone = false;

  const popup = new PopupWindow(scene, {
    title: t('checkpoint.window.title'),
    onClosed: () => {
      gone = true;
      if (!started) options.onClose?.();
    },
  });
  const { content } = popup;
  const balance = new BalanceChip(scene, 'berries', popup.innerWidth / 2, cfg.balanceHeight / 2);
  balance.snap(berries);
  content.add(balance.root);
  followBalance(scene, balance, content, () => berries);

  const dynamic = scene.add.container(0, 0);
  content.add(dynamic);
  const stepsTop = cfg.balanceHeight + cfg.balanceGap;
  const stepCount = rows.length;
  const stairsHeight = stepCount * cfg.stepHeight + (stepCount - 1) * cfg.stepGap;
  const buttonsTop = stepsTop + stairsHeight + cfg.buttonsGap;
  // The second button's room is kept only while some step offers an ad, so the window stays still
  // when the selection moves but is not taller than it must be.
  const fitHeight = (): void => {
    const adRoom = rows.some((row) => !row.locked && row.ad !== 'none');
    popup.setContentHeight(
      buttonsTop + button.height + (adRoom ? button.height + cfg.buttonGap : 0),
    );
  };

  const choose = async (height: StartHeight, method: 'free' | CheckpointMethod): Promise<void> => {
    if (busy || gone) return;
    busy = true;
    render();
    let result: 'started' | 'stay';
    try {
      result = await options.onChoose(height, method);
    } catch {
      result = 'stay';
    }
    busy = false;
    if (result === 'started') {
      started = true;
      popup.close();
    } else {
      render();
    }
  };

  const addButtons = (): void => {
    const row = rows.find((candidate) => candidate.height === selected);
    if (!row) return;
    const wanted = buttonsFor(row);
    const place = (made: Button, index: number): Button => {
      made.setY(buttonsTop + button.height / 2 + index * (button.height + cfg.buttonGap));
      if (busy) made.setEnabled(false);
      dynamic.add(made);
      return made;
    };
    if (wanted.main.kind === 'free') {
      const play = createTextButton(scene, {
        text: t('checkpoint.window.play'),
        font: cfg.playFont,
        maxLabelWidth: labelWidth,
        fill: PALETTE.accent,
        layout: button,
        keyPrefix: 'ui_checkpoint_play',
        onClick: () => void choose(selected, 'free'),
      });
      place(play.button, 0);
    } else {
      place(
        createPriceButton(scene, {
          template: t('checkpoint.window.playFor'),
          price: wanted.main.price,
          have: wanted.main.price - wanted.main.missing,
          currency: 'berries',
          fill: PALETTE.accent,
          layout: button,
          font: cfg.playFont,
          shortFont: cfg.shortFont,
          maxWidth: labelWidth,
          keyPrefix: 'ui_checkpoint_pay',
          onPay: () => void choose(selected, 'berries'),
          onShort: () => balance.shake(),
        }),
        0,
      );
    }
    if (wanted.ad === 'hidden') return;
    const ad = createTextButton(scene, {
      text: t('checkpoint.window.watchAd'),
      font: cfg.adFont,
      maxLabelWidth: labelWidth,
      fill: PALETTE.accentSecondary,
      layout: button,
      keyPrefix: 'ui_checkpoint_ad',
      onClick: () => void choose(selected, 'ad'),
    });
    place(ad.button, 1);
    if (wanted.ad === 'unavailable') {
      markAdUnavailable(ad.button, ad.label, labelWidth, cfg.disabledAlpha);
    }
  };

  function render(): void {
    if (gone) return;
    fitHeight();
    dynamic.removeAll(true);
    const width = popup.innerWidth - cfg.stepShift * (stepCount - 1);
    // The highest step is on top and furthest right; the free start stands at the bottom left.
    rows.forEach((row, index) => {
      const fromTop = stepCount - 1 - index;
      dynamic.add(
        createCheckpointStep(scene, {
          row,
          selected: row.height === selected,
          tappable: !busy,
          x: -popup.innerWidth / 2 + width / 2 + index * cfg.stepShift,
          y: stepsTop + cfg.stepHeight / 2 + fromTop * (cfg.stepHeight + cfg.stepGap),
          width,
          onSelect: () => {
            if (busy || row.locked) return;
            selected = row.height;
            render();
          },
        }),
      );
    });
    addButtons();
  }

  render();
  return {
    refresh(nextRows, nextBerries) {
      if (gone) return;
      rows = nextRows;
      berries = nextBerries;
      selected = keepSelection(rows, selected);
      render();
    },
    close: popup.close,
  };
}
