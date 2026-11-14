import * as Phaser from 'phaser';
import { xpToNext } from '../../../core/progression';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { services } from '../../../services';
import type { LevelUp, RunSummary } from '../../../state/game-state';
import { createOutlinedText } from '../outlined-text';
import { LevelUpPanel } from './level-up-panel';
import { stackRows } from './results-layout';
import { xpSegments } from './results-text';
import { XpBar } from './xp-bar';

const cfg = MENU.results;
/** From the bar line up to the top of its frame. */
const BAR_TOP = MENU.xpBar.height / 2 + MENU.xpBar.border;
/** Frame, gap and the numbers line below the bar. */
const BAR_BLOCK =
  BAR_TOP +
  MENU.xpBar.height +
  MENU.xpBar.labelGap +
  (MENU.xpBar.font * MENU.xpBar.numbersScale) / 2;

/** Fractional level of a save position (level 6 with half its XP is 6.5). */
function progressOf(level: number, xp: number): number {
  return level + xp / xpToNext(level);
}

/**
 * "+N XP" and the XP bar. `start` fills the bar from where the run began to where it ended;
 * on every level reached the bar flashes, the level-up window opens, and the fill goes on
 * from zero after the window closes.
 */
export class ResultsXp {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly bar: XpBar;
  private readonly from: number;
  private readonly to: number;
  private panel: LevelUpPanel | null = null;
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly summary: RunSummary,
    end: { level: number; xp: number },
  ) {
    this.container = scene.add.container(0, 0);
    this.from = progressOf(summary.before.level, summary.before.xp);
    this.to = progressOf(end.level, end.xp);
    const gain = createOutlinedText(
      scene,
      0,
      0,
      t('results.xp', { n: formatNumber(summary.xpGained) }),
      cfg.xpFont,
      PALETTE.gold,
    );
    this.bar = new XpBar(scene, 0, 0).show(summary.before.level, summary.before.xp);
    this.height = stackRows(
      this.container,
      [
        { obj: gain, height: cfg.xpFont * cfg.lineHeight },
        { obj: this.bar, height: BAR_BLOCK },
      ],
      cfg.rowGap,
    );
    // The bar's origin is the bar line; the row spans the frame above it and the numbers below.
    this.bar.y += BAR_TOP - BAR_BLOCK / 2;
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

  layout(width: number, height: number): void {
    this.panel?.layout(width, height);
  }

  /** The bar flashes, then the window of that level opens (when the run recorded one). */
  private levelReached(level: number, then: () => void): void {
    if (this.stopped) return;
    services.audio.coin();
    const { scale, ms, holdMs } = cfg.levelFlash;
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
