import * as Phaser from 'phaser';
import { MENU } from '../../data/common/menu-layout';
import { t } from '../../i18n';
import { gameState } from '../../state';
import { currentAdState, type AdState } from '../economy/ad-caption';
import { showRewarded } from '../economy/rewarded';
import { DAILY_RUN } from '../run/run-request';
import { openScreen, SCENES, startRunFrom } from '../app/scene-keys';
import { DailyAttempts } from '../ui/menu/daily/daily-attempts';
import { DailyBoard } from '../ui/menu/daily/daily-board';
import { gamesShown, openBoard } from '../games/games-actions';
import type { Button } from '../ui/common/button';
import { DailyDate } from '../ui/menu/daily/daily-date';
import { DailyIntroLine, openDailyIntro } from '../ui/menu/daily/daily-intro';
import { DailyLock } from '../ui/menu/daily/daily-lock';
import { DailyPlay } from '../ui/menu/daily/daily-play';
import { DailyRewards } from '../ui/menu/daily/daily-rewards';
import type { DailySection } from '../ui/menu/daily/daily-section';
import { DailyTeam, openAbilityWindow } from '../ui/menu/daily/daily-team';
import { ScreenHeader } from '../ui/menu/widgets/screen-header';
import { MenuScenery } from '../ui/style/menu-scenery';
import { safeFrame } from '../ui/common/safe-frame';
import { enterScreen, leaveScreen, type Movable } from '../ui/common/transition';

const cfg = MENU.daily;

/** The daily tower screen: what it is, team, rewards and attempts of the UTC day (docs/07-ui-screens.md, section 10). */
export class DailyScene extends Phaser.Scene {
  private bg!: MenuScenery;
  private header!: ScreenHeader;
  private date!: DailyDate;
  private team!: DailyTeam;
  private sections: DailySection[] = [];
  private attempts: DailyAttempts | null = null;
  private play: DailyPlay | null = null;
  private day = '';
  private leaving = false;
  private adRunning = false;
  /** Whether an ad was ready the last time the attempts block was drawn. */
  /** The ad state the ad buttons show ("Loading…" turns into the button when it loads). */
  private adState: AdState = 'ready';
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
    gameState.refreshDay();
    const info = gameState.dailyInfo();
    this.day = info.day;

    this.bg = new MenuScenery(this, 'list');
    this.header = new ScreenHeader(this, t('daily.title'), () => this.leave(SCENES.home));
    this.date = new DailyDate(this, info.day);
    this.team = new DailyTeam(this, info.team, (slot) => {
      if (!this.leaving) openAbilityWindow(this, slot.id, slot.level);
    });
    this.sections = [
      new DailyIntroLine(this, () => {
        if (!this.leaving) openDailyIntro(this);
      }),
      this.date,
      this.team,
      new DailyRewards(this, info.best, info.claimedTiers, info.played),
    ];
    if (info.unlocked) {
      this.attempts = new DailyAttempts(this, () => this.watchAd());
      // The daily leaderboard: a trophy next to Play where the game services are.
      this.play = new DailyPlay(
        this,
        () => this.startRun(),
        () => this.watchAd(),
        gamesShown() ? (button) => this.openBoard(button) : undefined,
      );
      this.sections.push(this.attempts, this.play);
    } else {
      this.sections.push(new DailyLock(this));
      // Before the tower opens there is no Play: the board of the day is a row of its own.
      if (gamesShown()) this.sections.push(new DailyBoard(this, () => this.leaving));
    }
    this.refresh();
    this.showTime(info.msUntilNext);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    enterScreen(this, this.content());
    // The explainer comes by itself on the first visit of the open tower.
    if (info.unlocked && !gameState.hasHint('dailyIntro')) openDailyIntro(this);
  }

  override update(time: number, delta: number): void {
    this.bg.update(delta);
    this.header.update(time, delta);
    this.team.tick(delta);
    if (this.attempts && !this.leaving && currentAdState() !== this.adState) {
      this.refresh();
    }
    this.clockMs += delta;
    if (this.clockMs < cfg.date.tickMs) return;
    this.clockMs = 0;
    const info = gameState.dailyInfo();
    if (info.day !== this.day && !this.leaving) {
      this.scene.restart();
      return;
    }
    this.showTime(info.msUntilNext);
  }

  private showTime(msLeft: number): void {
    this.date.update(msLeft);
    this.play?.update(msLeft);
  }

  /** Attempts, the ad buttons and the Play slot follow the save. */
  private refresh(): void {
    const info = gameState.dailyInfo();
    const view = { left: info.attemptsLeft, canAddAttempt: info.canAddAttempt };
    this.adState = currentAdState();
    const adReady = this.adState === 'ready';
    this.attempts?.refresh(view, adReady);
    // One timer on the screen: once the attempts ran out it stands in the Play slot.
    this.date.showTimer(!this.play || view.left > 0);
    this.play?.refresh(view, adReady, info.unlocked && !this.leaving);
    // The buttons may not come back while an ad plays or the screen is leaving.
    if (this.adRunning || this.leaving) this.disableAds();
  }

  private disableAds(): void {
    this.attempts?.ad.button.setEnabled(false);
    this.play?.ad.button.setEnabled(false);
  }

  private watchAd(): void {
    if (this.adRunning) return;
    this.adRunning = true;
    this.disableAds();
    void showRewarded('daily_attempt').then((result) => {
      this.adRunning = false;
      if (result === 'rewarded' && this.scene.isActive()) gameState.addDailyAttempt();
      if (this.scene.isActive()) this.refresh();
    });
  }

  private startRun(): void {
    if (this.leaving || !gameState.startDailyAttempt()) return;
    this.leaving = true;
    this.play?.play.setEnabled(false);
    this.disableAds();
    leaveScreen(this, this.content(), () => startRunFrom(this, DAILY_RUN));
  }

  private openBoard(button: Button): Promise<void> {
    return this.leaving ? Promise.resolve() : openBoard(this, 'daily_height', button);
  }

  private leave(key: typeof SCENES.home): void {
    if (this.leaving) return;
    this.leaving = true;
    leaveScreen(this, this.content(), () => openScreen(this, key));
  }

  private content(): Movable[] {
    return [...this.header.parts, ...this.sections.map((s) => s.root)];
  }

  /** Stacks the blocks under the header; spare height widens the gaps (up to `maxGap`). */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.bg.resize(width, height);
    const frame = safeFrame(height);
    this.header.layout(width, frame.top);
    const top = frame.top + MENU.header.contentTop;
    const used = this.sections.reduce((sum, s) => sum + s.height, 0);
    const slots = this.sections.length - 1;
    const spare = frame.bottom - top - cfg.bottom - used;
    const gap = Math.min(cfg.maxGap, Math.max(cfg.minGap, spare / slots));
    let y = top + Math.max(0, (spare - gap * slots) / 2);
    const cx = width / 2;
    for (const section of this.sections) {
      section.root.setPosition(cx, y);
      y += section.height + gap;
    }
  }
}
