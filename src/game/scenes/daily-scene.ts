import * as Phaser from 'phaser';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { DAILY_RUN } from '../run-request';
import { openScreen, SCENES, startRunFrom } from '../scene-keys';
import { createTextButton, type Button } from '../ui/button';
import { DailyAttempts } from '../ui/menu/daily-attempts';
import { DailyDate } from '../ui/menu/daily-date';
import { DailyLock } from '../ui/menu/daily-lock';
import { DailyRewards } from '../ui/menu/daily-rewards';
import { DailyRules } from '../ui/menu/daily-rules';
import type { DailySection } from '../ui/menu/daily-section';
import { DailyTeam } from '../ui/menu/daily-team';
import { fitText } from '../ui/menu/fit-text';
import { ScreenHeader } from '../ui/menu/screen-header';
import { MenuScenery } from '../ui/style/menu-scenery';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';

const cfg = MENU.daily;

/** The daily tower screen: team, rules, rewards and attempts of the UTC day (docs/07-ui-screens.md, section 10). */
export class DailyScene extends Phaser.Scene {
  private bg!: MenuScenery;
  private header!: ScreenHeader;
  private date!: DailyDate;
  private team!: DailyTeam;
  private sections: DailySection[] = [];
  private attempts: DailyAttempts | null = null;
  private play: Button | null = null;
  private playLabel: Phaser.GameObjects.Text | null = null;
  private day = '';
  private leaving = false;
  private adRunning = false;
  private clockMs = 0;

  constructor() {
    super(SCENES.daily);
  }

  create(): void {
    this.leaving = false;
    this.adRunning = false;
    this.clockMs = 0;
    this.attempts = null;
    this.play = null;
    this.playLabel = null;
    gameState.refreshDay();
    const info = gameState.dailyInfo();
    this.day = info.day;

    this.bg = new MenuScenery(this, 'list');
    this.header = new ScreenHeader(this, t('daily.title'), () => this.leave(SCENES.home));
    this.date = new DailyDate(this, info.day);
    this.team = new DailyTeam(this, info.team);
    this.sections = [
      this.date,
      this.team,
      new DailyRules(this),
      new DailyRewards(this, info.best, info.claimedTiers),
    ];
    if (info.unlocked) {
      this.attempts = new DailyAttempts(this, () => this.watchAd());
      this.sections.push(this.attempts);
      this.createPlay();
    } else {
      this.sections.push(new DailyLock(this));
    }
    this.refresh();
    this.date.update(info.msUntilNext);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    enterScreen(this, this.content());
  }

  override update(time: number, delta: number): void {
    this.bg.update(delta);
    this.header.update(time, delta);
    this.team.tick(delta);
    this.clockMs += delta;
    if (this.clockMs < cfg.date.tickMs) return;
    this.clockMs = 0;
    const info = gameState.dailyInfo();
    if (info.day !== this.day && !this.leaving) {
      this.scene.restart();
      return;
    }
    this.date.update(info.msUntilNext);
  }

  private createPlay(): void {
    const { button, label } = createTextButton(this, {
      text: t('daily.play'),
      font: cfg.play.font,
      maxLabelWidth: cfg.play.width - cfg.playPadding,
      fill: PALETTE.accent,
      layout: cfg.play,
      keyPrefix: 'ui_daily_play',
      onClick: () => this.startRun(),
    });
    this.play = button.breathe();
    this.playLabel = label;
  }

  /** Attempts, the ad button and the Play button follow the save. */
  private refresh(): void {
    const info = gameState.dailyInfo();
    const canPlay = info.unlocked && info.attemptsLeft > 0;
    this.attempts?.refresh(
      { left: info.attemptsLeft, canAddAttempt: info.canAddAttempt },
      services.ads.isRewardedReady(),
    );
    if (!this.play || !this.playLabel) return;
    this.playLabel.setText(t(canPlay ? 'daily.play' : 'daily.noAttempts'));
    fitText(this.playLabel, cfg.play.width - cfg.playPadding);
    this.play.setEnabled(canPlay && !this.leaving);
    this.play.setAlpha(canPlay ? 1 : cfg.playDisabledAlpha);
  }

  private watchAd(): void {
    if (this.adRunning) return;
    this.adRunning = true;
    this.attempts?.adButton.setEnabled(false);
    void services.ads.showRewarded('daily_attempt').then((result) => {
      this.adRunning = false;
      if (result === 'rewarded' && this.scene.isActive()) gameState.addDailyAttempt();
      if (this.scene.isActive()) this.refresh();
    });
  }

  private startRun(): void {
    if (this.leaving || !gameState.startDailyAttempt()) return;
    this.leaving = true;
    this.play?.setEnabled(false);
    this.attempts?.adButton.setEnabled(false);
    leaveScreen(this, this.content(), () => startRunFrom(this, DAILY_RUN));
  }

  private leave(key: typeof SCENES.home): void {
    if (this.leaving) return;
    this.leaving = true;
    leaveScreen(this, this.content(), () => openScreen(this, key));
  }

  private content(): Movable[] {
    const items: Movable[] = [...this.header.parts, ...this.sections.map((s) => s.root)];
    if (this.play) items.push(this.play);
    return items;
  }

  /** Stacks the blocks under the header; spare height widens the gaps (up to `maxGap`). */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.bg.resize(width, height);
    this.header.layout(width);
    const top = MENU.header.contentTop;
    const blocks = this.sections.map((s) => s.height);
    if (this.play) blocks.push(cfg.play.height);
    const used = blocks.reduce((sum, h) => sum + h, 0);
    const slots = blocks.length - 1;
    const spare = height - top - cfg.bottom - used;
    const gap = Math.min(cfg.maxGap, Math.max(cfg.minGap, spare / slots));
    let y = top + Math.max(0, (spare - gap * slots) / 2);
    const cx = width / 2;
    for (const section of this.sections) {
      section.root.setPosition(cx, y);
      y += section.height + gap;
    }
    this.play?.setPosition(cx, y + cfg.play.height / 2);
  }
}
