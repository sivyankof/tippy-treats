import type * as Phaser from 'phaser';
import { journalCounts } from '../../../../core/progression/journal';
import { MENU } from '../../../../data/common/menu-layout';
import type { JournalRowId } from '../../../../data/progression/journal';
import { t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { createOutlinedText } from '../../common/outlined-text';
import { PopupWindow } from '../../style/dialog-window';
import { wrapWithoutLoneWord } from '../widgets/fit-text';
import { stackColumn } from './journal-layout';
import { createJournalDish, createJournalIcon, createTierBar } from './journal-parts';
import { fliesDish, journalLabel, journalPhrase } from './journal-text';

const cfg = MENU.journal.detail;

/** A centred, wrapped text of the window. */
function paragraph(
  scene: Phaser.Scene,
  text: string,
  font: number,
  width: number,
): Phaser.GameObjects.Text {
  const line = createOutlinedText(scene, 0, 0, text, font).setAlign('center');
  line.setLineSpacing(cfg.lineSpacing);
  wrapWithoutLoneWord(line, width);
  return line;
}

/**
 * The window of the flies (`'flies'`: the dish of the tier and its caption) or the comparison of a
 * row (its big icon). Both end with the phrase of the tier and the bar to the next one. It opens
 * in place of the journal under its dark veil; `onBack` opens the journal again once this window
 * has shrunk away (cross, veil, Android back), and the veil stays dark meanwhile.
 */
export function openJournalDetail(
  scene: Phaser.Scene,
  id: JournalRowId | 'flies',
  onBack: () => void,
): PopupWindow {
  const counts = journalCounts(gameState.data.stats);
  const popup = new PopupWindow(scene, {
    title: id === 'flies' ? t('journal.flies.title') : journalLabel(id),
    onClosed: onBack,
    veil: { in: 'shown', out: 'keep' },
  });
  const width = popup.innerWidth;
  const dish = id === 'flies' ? fliesDish(counts) : null;
  const pictureSize = dish ? cfg.dish : cfg.icon;
  const texts = [
    ...(dish ? [paragraph(scene, dish.caption, cfg.captionFont, width)] : []),
    paragraph(scene, journalPhrase(id, counts), cfg.phraseFont, width),
  ];
  const heights = [pictureSize, ...texts.map((text) => text.height), cfg.barHeight];
  const column = stackColumn(heights, cfg.gap);
  const middle = (i: number): number => (column.tops[i] ?? 0) + (heights[i] ?? 0) / 2;
  const picture = dish
    ? createJournalDish(scene, dish.index, 0, middle(0), pictureSize)
    : createJournalIcon(scene, id as JournalRowId, 0, middle(0), pictureSize);
  popup.content.add(picture);
  texts.forEach((text, i) => {
    text.setY(middle(i + 1));
    popup.content.add(text);
  });
  popup.content.add(
    createTierBar(scene, id, counts, {
      x: 0,
      y: middle(heights.length - 1),
      width: cfg.barWidth,
      height: cfg.barHeight,
      font: cfg.barFont,
    }),
  );
  popup.setContentHeight(column.height);
  return popup;
}
