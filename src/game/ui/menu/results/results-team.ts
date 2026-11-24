import type * as Phaser from 'phaser';
import type { RunResult } from '../../../../core/run/run-result';
import { abilityCounts, type RunTally } from '../../../../core/run/run-tally';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { createOutlinedText } from '../../common/outlined-text';
import { createCreatureIcon } from '../../creatures/creature-icons';
import { fitText, onFontRefresh } from '../widgets/fit-text';

const cfg = MENU.results.team;

/**
 * The Team frame: "Combo" over "xN" at the left, then the creatures whose abilities triggered,
 * each with its face and "xN" under it, by count. Without any, "Combo xN" stands alone in the
 * middle. (0, 0) is the middle of the row, `width` the room inside the frame.
 */
export function createTeamContent(
  scene: Phaser.Scene,
  result: RunResult,
  tally: RunTally,
  width: number,
): Phaser.GameObjects.Container {
  const row = scene.add.container(0, 0);
  const triggered = abilityCounts(tally);
  const comboX = triggered.length > 0 ? -width / 2 + cfg.comboWidth / 2 : 0;
  const labelY = -cfg.height / 2 + cfg.comboLabelFont * 0.8;
  const label = createOutlinedText(scene, comboX, labelY, t('results.combo'), cfg.comboLabelFont);
  const value = createOutlinedText(
    scene,
    comboX,
    labelY + cfg.comboLabelFont * 0.6 + cfg.comboFont * 0.62,
    t('run.combo', { n: result.bestCombo }),
    cfg.comboFont,
    PALETTE.gold,
  );
  row.add([fitText(label, cfg.comboWidth), fitText(value, cfg.comboWidth)]);
  if (triggered.length === 0) return row;
  const left = -width / 2 + cfg.comboWidth;
  const step = (width - cfg.comboWidth) / triggered.length;
  // Icons shrink together when many creatures share the row.
  const size = Math.min(cfg.iconSize, step * 0.9);
  const iconY = -cfg.height / 2 + size / 2;
  triggered.forEach(({ id, count }, i) => {
    const x = left + step * (i + 0.5);
    const icon = createCreatureIcon(scene, x, iconY, id).setDisplaySize(size, size);
    const text = createOutlinedText(
      scene,
      x,
      cfg.height / 2 - cfg.countFont * 0.6,
      t('results.abilityCount', { n: formatNumber(count) }),
      cfg.countFont,
      PALETTE.gold,
    );
    row.add([icon, fitText(text, step)]);
  });
  return row;
}

/**
 * The Team frame folded into one row inside Rewards: "Combo xN" and the creatures with their
 * counts in a line, centred and fitted to `width`.
 */
export function createTeamRow(
  scene: Phaser.Scene,
  result: RunResult,
  tally: RunTally,
  width: number,
): Phaser.GameObjects.Container {
  const r = cfg.row;
  const row = scene.add.container(0, 0);
  const combo = createOutlinedText(scene, 0, 0, `${t('results.combo')} `, r.font).setOrigin(0, 0.5);
  const comboValue = createOutlinedText(
    scene,
    0,
    0,
    t('run.combo', { n: result.bestCombo }),
    r.font,
    PALETTE.gold,
  ).setOrigin(0, 0.5);
  row.add([combo, comboValue]);
  const items = abilityCounts(tally).map(({ id, count }) => {
    const icon = createCreatureIcon(scene, 0, 0, id).setDisplaySize(r.iconSize, r.iconSize);
    const text = createOutlinedText(
      scene,
      0,
      0,
      t('results.abilityCount', { n: formatNumber(count) }),
      r.font,
      PALETTE.gold,
    ).setOrigin(0, 0.5);
    row.add([icon, text]);
    return { icon, text };
  });
  const layout = (): void => {
    const comboWidth = combo.width + comboValue.width;
    const widths = items.map(({ text }) => r.iconSize + r.iconGap + text.width);
    const itemsWidth =
      widths.reduce((sum, w) => sum + w, 0) + r.itemGap * Math.max(0, items.length - 1);
    const total = comboWidth + (items.length > 0 ? r.comboGap + itemsWidth : 0);
    let x = -total / 2;
    combo.setX(x);
    comboValue.setX(x + combo.width);
    x += comboWidth + r.comboGap;
    items.forEach(({ icon, text }, i) => {
      icon.setPosition(x + r.iconSize / 2, 0);
      text.setX(x + r.iconSize + r.iconGap);
      x += (widths[i] ?? 0) + r.itemGap;
    });
    row.setScale(total > width ? width / total : 1);
  };
  layout();
  onFontRefresh(combo, layout);
  return row;
}
