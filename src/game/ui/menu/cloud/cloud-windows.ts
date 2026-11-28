import type * as Phaser from 'phaser';
import { CLOUD_WINDOW } from '../../../../data/common/cloud-window-layout';
import { PALETTE } from '../../../../data/common/palette';
import { getLang, t } from '../../../../i18n';
import { formatSavedAt, type SaveSummary } from '../../../cloud/cloud-summary';
import { createTextButton, type Button } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import type { VeilHandover } from '../../style/veil-handover';
import { createPlate, faceOffsetY } from '../../style/volume';
import { fitText } from '../widgets/fit-text';
import { PriceTag } from '../widgets/price-tag';
import { summaryCardHeight } from './summary-layout';

const cfg = CLOUD_WINDOW;

export interface FoundHandlers {
  restore: () => void;
  startOver: () => void;
}

export interface ChoiceHandlers {
  keepLocal: () => void;
  keepCloud: () => void;
}

/** A window that only its own buttons can close: no cross, the veil and the Android back do nothing. */
function openBound(
  scene: Phaser.Scene,
  title: string,
  veil: VeilHandover,
  onClosed?: () => void,
): PopupWindow {
  return new PopupWindow(scene, { title, closable: false, veil, onClosed });
}

function bodyText(scene: Phaser.Scene, text: string, width: number): Phaser.GameObjects.Text {
  return createOutlinedText(scene, 0, 0, text, cfg.textFont)
    .setOrigin(0.5, 0)
    .setAlign('center')
    .setWordWrapWidth(width, true);
}

interface Card {
  container: Phaser.GameObjects.Container;
  height: number;
}

/** The summary lines of one save on a plate, `head` over them when given; its top edge is at y = 0. */
function createSummaryCard(
  scene: Phaser.Scene,
  summary: SaveSummary,
  width: number,
  head?: string,
): Card {
  const { pad, headFont, lineFont, lineHeight, headGap, dateFont, fill } = cfg.card;
  const height = summaryCardHeight(head !== undefined);
  const inner = width - pad * 2;
  const face = faceOffsetY('card');
  const parts: Phaser.GameObjects.GameObject[] = [
    createPlate(scene, 'card', 0, 0, width, height, { fill }),
  ];
  let y = -height / 2 + pad + lineHeight / 2 + face;
  const text = (value: string, font: number, color?: number): void => {
    parts.push(fitText(createOutlinedText(scene, 0, y, value, font, color), inner));
    y += lineHeight;
  };
  const amount = (value: number, currency: 'coins' | 'berries'): void => {
    const tag = new PriceTag(scene, 0, y, lineFont).show('{price}', value, currency);
    if (tag.contentWidth > inner) tag.setScale(inner / tag.contentWidth);
    parts.push(tag);
    y += lineHeight;
  };
  if (head) {
    text(head, headFont, PALETTE.gold);
    y += headGap;
  }
  text(t('cloud.summary.level', { n: summary.bakerLevel }), lineFont);
  text(t('cloud.summary.record', { n: summary.record }), lineFont);
  text(t('cloud.summary.creatures', { n: summary.creatures }), lineFont);
  amount(summary.coins, 'coins');
  amount(summary.berries, 'berries');
  text(
    t('cloud.summary.date', { date: formatSavedAt(summary.savedAt, getLang()) }),
    dateFont,
    PALETTE.panel,
  );
  return { container: scene.add.container(0, 0, parts), height };
}

function stackedButton(
  scene: Phaser.Scene,
  label: string,
  fill: number,
  y: number,
  onClick: () => void,
): Button {
  return createTextButton(scene, {
    text: label,
    font: cfg.button.font,
    maxLabelWidth: cfg.button.width - cfg.button.radius * 2,
    fill,
    layout: cfg.button,
    keyPrefix: 'ui_cloud_button',
    y,
    onClick,
  }).button;
}

/** Locks every button at the first tap, then runs `action`. */
function once(buttons: () => Button[], action: () => void): () => void {
  let taken = false;
  return () => {
    if (taken) return;
    taken = true;
    for (const button of buttons()) button.setEnabled(false);
    action();
  };
}

/**
 * "Progress found in iCloud" at the first launch: the cloud summary and two answers. "Start over"
 * asks once more; its "Cancel" brings this window back.
 */
export function openFoundWindow(
  scene: Phaser.Scene,
  cloud: SaveSummary,
  handlers: FoundHandlers,
  shown = false,
): void {
  const veil: VeilHandover = { in: shown ? 'shown' : 'fade' };
  let next: (() => void) | null = null;
  const popup = openBound(scene, t('cloud.found.title'), veil, () => next?.());
  const text = bodyText(scene, t('cloud.found.text'), popup.innerWidth);
  const card = createSummaryCard(scene, cloud, popup.innerWidth);
  card.container.setPosition(0, text.height + cfg.textGap + card.height / 2);
  const cardBottom = text.height + cfg.textGap + card.height;
  const rowY = (row: number): number =>
    cardBottom + cfg.textGap + cfg.button.height / 2 + row * (cfg.button.height + cfg.buttonGap);
  const buttons: Button[] = [];
  const restore = stackedButton(
    scene,
    t('cloud.found.restore'),
    PALETTE.success,
    rowY(0),
    once(
      () => buttons,
      () => {
        popup.close();
        handlers.restore();
      },
    ),
  );
  const startOver = stackedButton(
    scene,
    t('cloud.found.startOver'),
    PALETTE.accentSecondary,
    rowY(1),
    once(
      () => buttons,
      () => {
        veil.out = 'keep';
        next = () => openStartOverSure(scene, cloud, handlers);
        popup.close();
      },
    ),
  );
  buttons.push(restore, startOver);
  popup.content.add([text, card.container, restore, startOver]);
  popup.setContentHeight(rowY(1) + cfg.button.height / 2);
}

/** The second question of "Start over": cancel goes back to the found window, confirm starts over. */
function openStartOverSure(scene: Phaser.Scene, cloud: SaveSummary, handlers: FoundHandlers): void {
  const veil: VeilHandover = { in: 'shown' };
  let next: (() => void) | null = null;
  const popup = openBound(scene, t('cloud.startOverSure.title'), veil, () => next?.());
  const text = bodyText(scene, t('cloud.startOverSure.text'), popup.innerWidth);
  const rowY = (row: number): number =>
    text.height + cfg.textGap + cfg.button.height / 2 + row * (cfg.button.height + cfg.buttonGap);
  const buttons: Button[] = [];
  const cancel = stackedButton(
    scene,
    t('cloud.startOverSure.cancel'),
    PALETTE.success,
    rowY(0),
    once(
      () => buttons,
      () => {
        veil.out = 'keep';
        next = () => openFoundWindow(scene, cloud, handlers, true);
        popup.close();
      },
    ),
  );
  const confirm = stackedButton(
    scene,
    t('cloud.startOverSure.confirm'),
    PALETTE.danger,
    rowY(1),
    once(
      () => buttons,
      () => {
        popup.close();
        handlers.startOver();
      },
    ),
  );
  buttons.push(cancel, confirm);
  popup.content.add([text, cancel, confirm]);
  popup.setContentHeight(rowY(1) + cfg.button.height / 2);
}

/** Two saves that differ: both summaries side by side, one "Keep" under each. */
export function openChoiceWindow(
  scene: Phaser.Scene,
  local: SaveSummary,
  cloud: SaveSummary,
  handlers: ChoiceHandlers,
): void {
  const popup = openBound(scene, t('cloud.choice.title'), {});
  const text = bodyText(scene, t('cloud.choice.text'), popup.innerWidth);
  const cardWidth = (popup.innerWidth - cfg.cardGap) / 2;
  const { height: keepHeight, radius, shadowOffset, font } = cfg.keepButton;
  const layout = { width: cardWidth, height: keepHeight, radius, shadowOffset };
  const buttons: Button[] = [];
  const guarded = (action: () => void) =>
    once(
      () => buttons,
      () => {
        popup.close();
        action();
      },
    );
  const column = (
    summary: SaveSummary,
    head: string,
    x: number,
    action: () => void,
  ): Phaser.GameObjects.GameObject[] => {
    const card = createSummaryCard(scene, summary, cardWidth, head);
    const cardTop = text.height + cfg.textGap;
    card.container.setPosition(x, cardTop + card.height / 2);
    const keep = createTextButton(scene, {
      text: t('cloud.choice.keep'),
      font,
      maxLabelWidth: cardWidth - radius * 2,
      fill: PALETTE.success,
      layout,
      keyPrefix: 'ui_cloud_keep',
      x,
      y: cardTop + card.height + cfg.keepGap + keepHeight / 2,
      onClick: guarded(action),
    }).button;
    buttons.push(keep);
    return [card.container, keep];
  };
  const dx = (cardWidth + cfg.cardGap) / 2;
  const parts = [
    ...column(local, t('cloud.choice.device'), -dx, handlers.keepLocal),
    ...column(cloud, t('cloud.choice.cloud'), dx, handlers.keepCloud),
  ];
  popup.content.add([text, ...parts]);
  popup.setContentHeight(
    text.height + cfg.textGap + summaryCardHeight(true) + cfg.keepGap + keepHeight,
  );
}
