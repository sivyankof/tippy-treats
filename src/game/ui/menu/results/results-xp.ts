import * as Phaser from 'phaser';
import { xpToNext } from '../../../../core/progression/progression';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { OVEN } from '../../../../data/progression/progression';
import { formatNumber, t } from '../../../../i18n';
import { cssColor } from '../../../../util/color';
import { services } from '../../../../services';
import type { LevelUp, RunSummary } from '../../../../state/game-state';
import { effectsMode } from '../../../app/effects-mode';
import { OVEN_PICTURE_HEIGHT } from '../../../fx/economy/oven-texture';
import { createOutlinedText } from '../../common/outlined-text';
import { StatTile } from '../../style/stat-tile';
import { OvenPicture } from '../oven/oven-picture';
import { fitText } from '../widgets/fit-text';
import { XpBar } from '../widgets/xp-bar';
import { LevelUpPanel } from './level-up-panel';
import { xpSegments } from './results-text';
import { tileLook } from './results-tiles';

const cfg = MENU.results;

/** Fractional level of a save position (level 6 with half its XP is 6.5). */
function progressOf(level: number, xp: number): number {
  return level + xp / xpToNext(level);
}

/**
 * The XP of the run: the XP tile ("+N", "XP x6" with a fresh oven), the level bar of the level row
 * and the status line under it. `start` fills the bar from where the run began to where it ended;
 * on every level reached the bar flashes, the status line says "New level!", the level-up window
 * opens, and the fill goes on from zero after the window closes.
 */
export class ResultsXp {
  readonly tile: StatTile;
  readonly bar: XpBar;
  /** "New level!" or "The fresh oven lights up again tomorrow!"; empty until there is something to say. */
  readonly status: Phaser.GameObjects.Text;
  private readonly from: number;
  private readonly to: number;
  private panel: LevelUpPanel | null = null;
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly summary: RunSummary,
    end: { level: number; xp: number },
    tileWidth: number,
    barWidth: number,
  ) {
    this.from = progressOf(summary.before.level, summary.before.xp);
    this.to = progressOf(end.level, end.xp);
    const fresh = (summary.oven?.fresh ?? 0) > 0;
    const icon = new OvenPicture(scene, 0, 0, { state: 'lit', face: false }).setScale(
      cfg.tiles.iconSize / OVEN_PICTURE_HEIGHT,
    );
    this.tile = new StatTile(scene, {
      ...tileLook(tileWidth),
      icon,
      label: fresh ? t('results.tile.xpOven', { n: OVEN.layersPerXp }) : t('results.tile.xp'),
    }).setValue(`+${formatNumber(summary.xpGained)}`);
    const row = cfg.levelRow;
    this.bar = new XpBar(scene, 0, 0, barWidth, {
      barHeight: row.barHeight,
      levelFont: row.levelFont,
      insideFont: row.barFont,
    }).show(summary.before.level, summary.before.xp);
    this.status = createOutlinedText(scene, 0, 0, '', cfg.statusFont, PALETTE.gold);
  }

  /** The XP fill reaches a whole level: the status line will say "New level!". */
  get reachesLevel(): boolean {
    return xpSegments(this.from, this.to).some((piece) => piece.reaches !== null);
  }

  /** The oven line shows until a level is reached (when the run emptied the oven and there is room). */
  showOvenLine(show: boolean): void {
    if (show && this.summary.oven?.ranOut) this.setStatus(t('oven.ranOut'), PALETTE.gold);
  }

  /** Runs the fill and the level-up windows; `onDone` follows the last of them. */
  start(onDone: () => void): void {
    const pieces = xpSegments(this.from, this.to);
    const next = (i: number): void => {
      if (this.stopped) return;
      const piece = pieces[i];
      if (!piece) {
        onDone();
        return;
      }
      const fraction = piece.to - piece.from;
      const duration = Math.max(cfg.xpMinMs, cfg.xpFillMs * fraction);
      this.scene.tweens.addCounter({
        from: piece.from,
        to: piece.to,
        duration,
        ease: 'Sine.easeOut',
        onUpdate: (tween) => this.bar.setProgress(tween.getValue() ?? piece.to),
        onComplete: () => {
          this.bar.setProgress(piece.to);
          if (piece.reaches === null) next(i + 1);
          else this.levelReached(piece.reaches, () => next(i + 1));
        },
      });
    };
    this.scene.time.delayedCall(cfg.xpStartDelayMs, () => next(0));
  }

  /** Cancels what is still to come: no more fills, flashes or level-up windows. */
  stop(): void {
    this.stopped = true;
  }

  update(dtMs: number): void {
    this.panel?.tick(dtMs);
  }

  private setStatus(text: string, color: number): void {
    this.status.setText(text).setColor(cssColor(color));
    fitText(this.status, cfg.frames.width - cfg.frames.padX * 2);
  }

  /** The bar flashes and "New level!" pops up, then the window of that level opens (when the run recorded one). */
  private levelReached(level: number, then: () => void): void {
    if (this.stopped) return;
    services.audio.coin();
    this.setStatus(t('results.newLevel'), PALETTE.accent);
    const { scale, ms, holdMs } = cfg.levelFlash;
    if (!effectsMode.reduced) {
      const rest = this.status.scale;
      this.status.setScale(rest * scale);
      this.scene.tweens.add({
        targets: this.status,
        scale: rest,
        duration: ms * 2,
        ease: 'Back.easeOut',
      });
    }
    this.scene.tweens.add({
      targets: this.bar,
      scale,
      duration: ms,
      yoyo: true,
      onComplete: () => {
        if (this.stopped) return;
        const levelUp: LevelUp | undefined = this.summary.levelUps.find((u) => u.level === level);
        if (!levelUp) {
          this.scene.time.delayedCall(holdMs, then);
          return;
        }
        this.scene.time.delayedCall(holdMs, () => {
          if (this.stopped) return;
          this.panel = new LevelUpPanel(this.scene, levelUp, () => {
            this.panel = null;
            then();
          });
        });
      },
    });
  }
}
