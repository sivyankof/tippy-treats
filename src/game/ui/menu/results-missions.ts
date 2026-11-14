import * as Phaser from 'phaser';
import { share } from '../../../core/missions';
import type { MissionProgress } from '../../../core/save/schema';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { services } from '../../../services';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';
import { justCompleted, movedMissions } from './missions-model';
import { ProgressBar } from './progress-bar';
import { stackRows, type Row } from './results-layout';

const cfg = MENU.results.missions;

interface MissionRow {
  bar: ProgressBar;
  from: MissionProgress;
  to: MissionProgress;
  done: boolean;
}

/** Eases a share from 0 to 1 over the fill. */
function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

/**
 * The missions this run moved: a title and up to three compact rows, each with a bar that fills
 * from where the run began to where it ended and a "Done!" mark on a mission it completed.
 * `height` is 0 when the run moved none (nothing to add to the screen then).
 */
export class ResultsMissions {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block; 0 when it is empty. */
  readonly height: number;
  private readonly rows: MissionRow[] = [];
  private elapsedMs = 0;
  private started = false;

  constructor(
    scene: Phaser.Scene,
    before: readonly MissionProgress[],
    after: readonly MissionProgress[],
    rowLimit: number,
  ) {
    this.container = scene.add.container(0, 0);
    const moved = movedMissions(before, after).slice(0, rowLimit);
    if (moved.length === 0) {
      this.height = 0;
      this.container.setVisible(false);
      return;
    }
    const list: Row[] = [
      {
        obj: createOutlinedText(
          scene,
          0,
          0,
          t('resultsMissions.title'),
          cfg.titleFont,
          PALETTE.gold,
        ),
        height: cfg.titleFont * MENU.results.lineHeight,
      },
    ];
    for (const { before: from, after: to } of moved) {
      const row = scene.add.container(0, 0);
      const text = createOutlinedText(
        scene,
        -cfg.width / 2,
        0,
        t(`mission.${to.id}`, { n: formatNumber(to.target) }),
        cfg.textFont,
      ).setOrigin(0, 0.5);
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
      row.add([text, bar]);
      this.rows.push({ bar, from, to, done: false });
      this.show(this.rows[this.rows.length - 1], 0);
      list.push({ obj: row, height: cfg.rowHeight });
    }
    this.height = stackRows(this.container, list, cfg.rowGap);
  }

  /** The bars begin to fill (after the screen is in). */
  start(): void {
    this.started = true;
  }

  update(dtMs: number): void {
    if (!this.started || this.rows.length === 0) return;
    this.elapsedMs += dtMs;
    const share = Math.max(0, Math.min(1, (this.elapsedMs - cfg.delayMs) / cfg.fillMs));
    for (const row of this.rows) this.show(row, easeOut(share));
    if (share >= 1) this.started = false;
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
      services.haptics.play('success');
      services.audio.coin();
      const label = row.bar.labelObject;
      const scale = label.scale;
      label.scene.tweens.add({
        targets: label,
        scale: scale * cfg.doneScale,
        duration: cfg.doneMs,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }
}
