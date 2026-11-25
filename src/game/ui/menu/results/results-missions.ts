import * as Phaser from 'phaser';
import { isComplete, share } from '../../../../core/progression/missions';
import type { MissionProgress } from '../../../../core/save/schema';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { services } from '../../../../services';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import { justCompleted, movedMissions } from '../missions/missions-model';
import { ProgressBar } from '../widgets/progress-bar';

const cfg = MENU.results.missions;

interface MissionRow {
  bar: ProgressBar;
  from: MissionProgress;
  to: MissionProgress;
  done: boolean;
}

/** The folded line: "Missions: N/M", where N counts up as the missions the run completed fill. */
interface FoldedLine {
  label: Phaser.GameObjects.Text;
  /** Missions done before the run. */
  base: number;
  /** Missions this run completed. */
  gained: number;
  /** Of those, how many have been marked so far. */
  marked: number;
}

/** Eases a share from 0 to 1 over the fill. */
function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

/** A row: the text on the left and a progress bar on the right. */
function createRow(
  scene: Phaser.Scene,
  label: string,
  colour?: number,
): { row: Phaser.GameObjects.Container; bar: ProgressBar; text: Phaser.GameObjects.Text } {
  const text = createOutlinedText(scene, -cfg.width / 2, 0, label, cfg.textFont, colour).setOrigin(
    0,
    0.5,
  );
  fitText(text, cfg.textWidth);
  const bar = new ProgressBar(
    scene,
    cfg.width / 2 - cfg.barWidth / 2,
    0,
    cfg.barWidth,
    cfg.barHeight,
    cfg.barFont,
    PALETTE.success,
  );
  return { row: scene.add.container(0, 0, [text, bar]), bar, text };
}

/**
 * The missions this run moved, the rows of the Missions frame: up to three compact rows, each with
 * a bar that fills from where the run began to where it ended and a "Done!" mark on a mission it
 * completed. `count` is 0 when the run moved none (no Missions frame then).
 */
export class ResultsMissions {
  /** The rows on show, top to bottom: the full ones, or the one folded row. */
  rows: Phaser.GameObjects.Container[] = [];
  private fullRowObjects: Phaser.GameObjects.Container[] = [];
  private readonly moved: ReadonlyArray<{ before: MissionProgress; after: MissionProgress }>;
  private fullRows: MissionRow[] = [];
  private bars: MissionRow[] = [];
  private folded: FoldedLine | null = null;
  private elapsedMs = 0;
  private started = false;

  constructor(
    scene: Phaser.Scene,
    before: readonly MissionProgress[],
    after: readonly MissionProgress[],
    rowLimit: number,
  ) {
    const moved = movedMissions(before, after).slice(0, rowLimit);
    this.moved = moved;
    for (const { before: from, after: to } of moved) {
      const { row, bar } = createRow(scene, t(`mission.${to.id}`, { n: formatNumber(to.target) }));
      this.fullRows.push({ bar, from, to, done: false });
      this.show(this.fullRows[this.fullRows.length - 1], 0);
      this.fullRowObjects.push(row);
    }
    this.bars = this.fullRows;
    this.rows = this.fullRowObjects;
  }

  /** How many missions the run moved (the rows of the full block). */
  get count(): number {
    return this.moved.length;
  }

  /**
   * Folds the block into one line ("Missions: N/M" and the bar of the most advanced mission that
   * is not done yet) for a short screen. Call before the screen is shown.
   */
  fold(scene: Phaser.Scene): void {
    if (this.moved.length <= 1 || this.bars !== this.fullRows) return;
    const open = this.moved.filter(({ after }) => !isComplete(after));
    const pick = open.reduce<MissionProgress | null>((best, { after }) => {
      const better = !best || share(after) > share(best);
      return better ? after : best;
    }, null);
    const shown =
      this.moved.find(({ after }) => after === pick) ?? this.moved[this.moved.length - 1];
    if (!shown) return;
    const gained = this.moved.filter(({ before, after }) => justCompleted(before, after)).length;
    const base = this.moved.length - open.length - gained;
    const { row, bar, text } = createRow(
      scene,
      t('resultsMissions.folded', { done: base, total: this.moved.length }),
      PALETTE.gold,
    );
    for (const full of this.fullRowObjects) full.destroy();
    this.fullRowObjects = [];
    this.rows = [row];
    this.folded = { label: text, base, gained, marked: 0 };
    // The bar's own "Done!" feedback is left to the folded line, which marks every completed mission.
    this.bars = [{ bar, from: shown.before, to: shown.after, done: true }];
    this.show(this.bars[0], 0);
  }

  /** The bars begin to fill (after the screen is in). */
  start(): void {
    this.started = true;
  }

  update(dtMs: number): void {
    if (!this.started || this.bars.length === 0) return;
    this.elapsedMs += dtMs;
    const share = Math.max(0, Math.min(1, (this.elapsedMs - cfg.delayMs) / cfg.fillMs));
    const eased = easeOut(share);
    for (const row of this.bars) this.show(row, eased);
    this.markFolded(eased);
    if (share >= 1) this.started = false;
  }

  /** Counts the folded line up: one step and one "Done!" feedback for each completed mission. */
  private markFolded(k: number): void {
    const line = this.folded;
    if (!line) return;
    const reached = k >= 1 ? line.gained : Math.floor(k * line.gained);
    while (line.marked < reached) {
      line.marked += 1;
      line.label.setText(
        t('resultsMissions.folded', { done: line.base + line.marked, total: this.moved.length }),
      );
      fitText(line.label, cfg.textWidth);
      this.celebrate(line.label);
    }
  }

  /** The "Done!" feedback: a success buzz, the coin sound and a pulse of `target`. */
  private celebrate(target: Phaser.GameObjects.Text): void {
    services.haptics.play('success');
    services.audio.coin();
    const scale = target.scale;
    target.scene.tweens.add({
      targets: target,
      scale: scale * cfg.doneScale,
      duration: cfg.doneMs,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Draws a row `k` of the way from its start to its end. */
  private show(row: MissionRow | undefined, k: number): void {
    if (!row) return;
    const { from, to } = row;
    const progress = from.progress + (to.progress - from.progress) * k;
    const value = Math.round(progress);
    row.bar.setShare(share({ progress, target: to.target }));
    const finished = k >= 1 && justCompleted(from, to);
    row.bar.setLabel(
      finished
        ? t('missions.done')
        : t('missions.progress', { n: formatNumber(value), total: formatNumber(to.target) }),
    );
    if (finished && !row.done) {
      row.done = true;
      this.celebrate(row.bar.labelObject);
    }
  }
}
