import type * as Phaser from 'phaser';
import { journalCounts, type JournalCounts } from '../../../../core/progression/journal';
import { MENU } from '../../../../data/common/menu-layout';
import { JOURNAL_ROW_IDS, type JournalRowId } from '../../../../data/progression/journal';
import { t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import { faceOffsetY, VolumePlate } from '../../style/volume';
import { fitText } from '../widgets/fit-text';
import { makeTappable } from '../home/home-badges';
import { openJournalDetail } from './journal-detail';
import { logJournalOpen } from './journal-telemetry';
import { stackColumn } from './journal-layout';
import { createChevron, createJournalIcon, createTierBar } from './journal-parts';
import { fliesRank, journalAmount, journalLabel } from './journal-text';

const cfg = MENU.journal;

/** The plate with a tap on it: the container sits on the centre of the plate. */
function tappablePlate(
  scene: Phaser.Scene,
  y: number,
  width: number,
  height: number,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const plate = new VolumePlate(scene, 'card', height).setBodyWidth(width);
  const box = scene.add.container(0, y, [plate]);
  makeTappable(box, width, height, onTap);
  return box;
}

/** The fly bar on top: the fly, the rank and the bar to the next tier. */
function createFliesPlate(
  scene: Phaser.Scene,
  y: number,
  width: number,
  counts: JournalCounts,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const box = tappablePlate(scene, y, width, cfg.barHeight, onTap);
  const dy = faceOffsetY('card');
  const left = -width / 2 + cfg.padX;
  const iconX = left + cfg.barIcon / 2;
  const textLeft = left + cfg.barIcon + cfg.iconGap;
  const right = width / 2 - cfg.padX - cfg.chevron - cfg.chevronGap;
  const rank = createOutlinedText(scene, textLeft, cfg.rankY + dy, fliesRank(counts), cfg.rankFont);
  rank.setOrigin(0, 0.5);
  fitText(rank, right - textLeft);
  const bar = createTierBar(scene, 'flies', counts, {
    x: (textLeft + right) / 2,
    y: cfg.barY + dy,
    width: right - textLeft,
    height: cfg.barHeightPx,
    font: cfg.barFont,
  });
  box.add([
    createJournalIcon(scene, 'flies', iconX, dy, cfg.barIcon),
    rank,
    bar,
    createChevron(scene, width / 2 - cfg.padX - cfg.chevron / 2, dy),
  ]);
  return box;
}

/** A row of a counter: icon, name, the number and the arrow. */
function createRow(
  scene: Phaser.Scene,
  id: JournalRowId,
  y: number,
  width: number,
  counts: JournalCounts,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const box = tappablePlate(scene, y, width, cfg.rowHeight, onTap);
  const dy = faceOffsetY('card');
  const left = -width / 2 + cfg.padX;
  const chevronX = width / 2 - cfg.padX - cfg.chevron / 2;
  const value = createOutlinedText(
    scene,
    chevronX - cfg.chevron / 2 - cfg.chevronGap,
    dy,
    journalAmount(id, counts[id]),
    cfg.valueFont,
  ).setOrigin(1, 0.5);
  const labelLeft = left + cfg.rowIcon + cfg.iconGap;
  const label = createOutlinedText(scene, labelLeft, dy, journalLabel(id), cfg.rowFont);
  label.setOrigin(0, 0.5);
  fitText(label, value.x - value.width - cfg.valueGap - labelLeft);
  box.add([
    createJournalIcon(scene, id, left + cfg.rowIcon / 2, dy, cfg.rowIcon),
    label,
    value,
    createChevron(scene, chevronX, dy),
  ]);
  return box;
}

/** The journal opened from the level plate of Home: the only opening that sends `journal_open`. */
export function openJournalFromHome(scene: Phaser.Scene, onClosed: () => void): PopupWindow {
  logJournalOpen();
  return openJournalWindow(scene, onClosed);
}

/**
 * The baker's journal (docs/07-ui-screens.md, section 2.2): the fly bar and a row per counter,
 * stacked in one column at one gap, so an item appended to the column only makes the window
 * taller. A tap on the bar or a row puts its detail window in place of the journal; closing that
 * brings the journal back. The veil stays dark through both swaps: only the window changes.
 * `onClosed` runs when the journal itself is closed; `veilShown` is set on the way back.
 */
export function openJournalWindow(
  scene: Phaser.Scene,
  onClosed?: () => void,
  veilShown = false,
): PopupWindow {
  const counts = journalCounts(gameState.data.stats);
  const popup = new PopupWindow(scene, {
    title: t('journal.title'),
    onClosed,
    veil: { in: veilShown ? 'shown' : 'fade' },
  });
  const column = stackColumn([cfg.barHeight, ...JOURNAL_ROW_IDS.map(() => cfg.rowHeight)], cfg.gap);
  // The detail takes the place of the journal under the same dark veil: it opens first, then the
  // journal goes at once, so there is never a frame with no veil or with two.
  const show = (id: JournalRowId | 'flies'): void => {
    // A tap during the close animation lets the journal close as asked.
    if (popup.leaving) return;
    openJournalDetail(scene, id, () => openJournalWindow(scene, onClosed, true));
    popup.destroy();
  };
  const centre = (index: number, height: number): number => (column.tops[index] ?? 0) + height / 2;
  popup.content.add(
    createFliesPlate(scene, centre(0, cfg.barHeight), popup.innerWidth, counts, () =>
      show('flies'),
    ),
  );
  JOURNAL_ROW_IDS.forEach((id, i) => {
    popup.content.add(
      createRow(scene, id, centre(i + 1, cfg.rowHeight), popup.innerWidth, counts, () => show(id)),
    );
  });
  popup.setContentHeight(column.height);
  return popup;
}
