import * as Phaser from 'phaser';
import { canFillTeam } from '../../core/creatures/team';
import type { CreatureId } from '../../data/creatures/creatures';
import { MENU } from '../../data/common/menu-layout';
import { PALETTE } from '../../data/common/palette';
import { t } from '../../i18n';
import { gameState } from '../../state';
import { prepareRemoveAdsOffer } from '../economy/interstitial-flow';
import { syncPurchases } from '../economy/purchases';
import type { RunRequest } from '../run/run-request';
import { startRunFrom, openScreen, SCENES, type HomeData } from '../app/scene-keys';
import type { PopupWindow } from '../ui/style/dialog-window';
import { createTextButton, type Button } from '../ui/common/button';
import { HomeStarterOffer } from '../ui/menu/home/home-starter';
import { HomeStartFrom } from '../ui/menu/home/home-start-from';
import { createHintBubble } from '../ui/menu/home/home-hint';
import { HomeBadges } from '../ui/menu/home/home-badges';
import { HomeNav } from '../ui/menu/home/home-nav';
import {
  createLevelPlate,
  createPlayRing,
  createRecordPlate,
  refreshLevelPlate,
  setLevelPlateEnabled,
} from '../ui/menu/home/home-plates';
import { OvenPlate } from '../ui/menu/oven/oven-plate';
import { openOvenWindow } from '../ui/menu/oven/oven-window';
import { HomeShelf } from '../ui/menu/home/home-shelf';
import { openGiftWindow } from '../ui/menu/home/gift-window';
import { openJournalWindow } from '../ui/menu/journal/journal-window';
import { openMissionsWindow } from '../ui/menu/missions/missions-window';
import { openSettingsWindow } from '../ui/menu/settings/settings-window';
import { ScreenHeader } from '../ui/menu/widgets/screen-header';
import { openStreakCalendar, openStreakEntry } from '../ui/menu/streak/streak-windows';
import { runHomeAsks } from '../ui/menu/home/home-asks';
import type { StreakClaim } from '../../state/game-state';
import { MenuScenery } from '../ui/style/menu-scenery';
import { safeFrame } from '../ui/common/safe-frame';
import { enterScreen, leaveScreen, type Movable } from '../ui/common/transition';

const cfg = MENU.home;

/**
 * The main screen, in the kitchen of the run: the level and the wallet on top, the team on its
 * shelf under a warm light, the record, the big Play button and the bottom bar.
 */
export class HomeScene extends Phaser.Scene {
  private scenery!: MenuScenery;
  private header!: ScreenHeader;
  private level!: Phaser.GameObjects.Container;
  private oven!: OvenPlate;
  private ovenTimer = 0;
  private shelf!: HomeShelf;
  private record!: Phaser.GameObjects.Container;
  private play!: Button;
  private startFrom!: HomeStartFrom;
  private nav!: HomeNav;
  private badges!: HomeBadges;
  private hint: ReturnType<typeof createHintBubble> | null = null;
  private ring: Phaser.GameObjects.Container | null = null;
  private starter!: HomeStarterOffer;
  private leaving = false;
  /** Kept so a language restart redraws the ring on Play. */
  private highlightPlay = false;
  private settings: PopupWindow | null = null;
  private journalOpen = false;

  constructor() {
    super(SCENES.home);
  }

  create(data?: HomeData): void {
    this.leaving = false;
    this.settings = null;
    this.journalOpen = false;
    this.highlightPlay = data?.highlightPlay ?? false;
    gameState.refreshDay();
    this.hint = null;
    this.ring = null;
    this.starter = new HomeStarterOffer(this, {
      leaving: () => this.leaving,
      changed: () => this.layout(),
      bought: (creature) => {
        this.refreshMarks();
        if (creature !== null) this.showNewCreatures([creature]);
      },
    });
    this.scenery = new MenuScenery(this, 'home');
    this.shelf = new HomeShelf(this, () => this.goTo(() => openScreen(this, SCENES.team)));
    this.record = createRecordPlate(this);
    this.nav = new HomeNav(this, {
      shop: () => this.goTo(() => openScreen(this, SCENES.shop, { source: 'home' })),
      collection: () => this.goTo(() => openScreen(this, SCENES.collection)),
      play: () => this.startRun(),
      daily: () => this.goTo(() => openScreen(this, SCENES.daily)),
      missions: () =>
        openMissionsWindow(this, (creatures) => this.afterMissions(creatures), this.header.wallet),
    });
    this.badges = new HomeBadges(this, {
      streak: () =>
        openStreakCalendar(this, (claim) => this.afterStreak(claim), this.header.wallet),
      gift: () => openGiftWindow(this, () => this.refreshMarks(), this.header.wallet),
      settings: () => this.openSettings(),
    });
    this.level = createLevelPlate(this, () => this.openJournal());
    this.oven = new OvenPlate(this, () => this.openOven());
    this.showOven();
    this.header = new ScreenHeader(this, '', null);

    this.play = createTextButton(this, {
      text: t('home.play'),
      font: cfg.playFont,
      maxLabelWidth: cfg.playWidth - cfg.playRadius * 2,
      fill: PALETTE.accent,
      layout: {
        width: cfg.playWidth,
        height: cfg.playHeight,
        radius: cfg.playRadius,
        shadowOffset: cfg.playShadow,
      },
      keyPrefix: 'ui_home_play',
      onClick: () => this.startRun(),
    }).button.breathe();

    const { team, creatures, bakerLevel } = gameState.data;
    if (canFillTeam(team, creatures, bakerLevel)) {
      this.hint = createHintBubble(this, t('home.teamHint'), () =>
        this.goTo(() => openScreen(this, SCENES.team)),
      );
    }
    this.startFrom = new HomeStartFrom(
      this,
      (request) => this.startRun(request),
      () => this.leaving,
    );
    if (this.highlightPlay) this.ring = createPlayRing(this);
    if (this.starter.room) void this.starter.start();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    this.setEnabled(false);
    enterScreen(this, this.content(), () => {
      this.setEnabled(true);
      if (data?.reopenSettings) this.openSettings();
      else runHomeAsks(this, () => this.showDayEntry());
    });
  }

  override update(time: number, delta: number): void {
    this.scenery.update(delta);
    this.header.update(time, delta);
    this.shelf.update(delta);
    this.badges.update();
    // The oven's wait is in whole minutes and a new day lights it: looking every tick is cheap.
    this.ovenTimer += delta;
    if (this.ovenTimer >= cfg.ovenPlate.tickMs) {
      this.ovenTimer = 0;
      this.showOven();
    }
  }

  private showOven(): void {
    this.oven.show({ left: gameState.ovenLeft, waitMs: gameState.msUntilOven });
  }

  /** A tap on the oven plate: the explainer again. */
  private openOven(): void {
    if (this.leaving) return;
    openOvenWindow(this);
  }

  /** A tap on the level plate: the baker's journal (one at a time, also while it is closing). */
  private openJournal(): void {
    if (this.leaving || this.journalOpen) return;
    this.journalOpen = true;
    openJournalWindow(this, () => (this.journalOpen = false));
  }

  /** Everything that slides with the screen; the scenery stays. */
  private content(): Movable[] {
    const items: Movable[] = [
      this.level,
      this.oven,
      ...this.badges.parts,
      ...this.header.parts,
      this.shelf.root,
      this.record,
    ];
    if (this.hint) items.push(this.hint.root);
    if (this.ring) items.push(this.ring);
    if (this.starter.button) items.push(this.starter.button);
    if (this.startFrom.button) items.push(this.startFrom.button);
    items.push(this.play, ...this.nav.parts);
    return items;
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    const frame = safeFrame(height);
    const extra = Math.max(0, frame.height - cfg.baseHeight) * cfg.extraShare;
    this.cameras.main.setSize(width, height);
    this.scenery.resize(width, height);
    this.header.layout(width, frame.top);
    this.badges.layout(width, frame.top);
    const level = cfg.levelPlate;
    this.level.setPosition(level.left + level.width / 2, frame.top + level.y);
    this.oven.setPosition(cx, frame.top + cfg.ovenPlate.y + extra * cfg.ovenPlate.extraShare);
    this.shelf.root.setPosition(cx, frame.top + cfg.shelf.y + extra);
    this.record.setPosition(cx, frame.top + cfg.record.y + extra * cfg.record.extraShare);
    const navTop = this.nav.layout(width, height, frame.bottom);
    const playY = navTop - cfg.playAboveNav - cfg.playHeight / 2;
    this.play.setPosition(cx, playY);
    this.ring?.setPosition(cx, playY);
    const offerRoom = this.startFrom.layoutOffers(cx, playY - cfg.playHeight / 2, this.starter);
    this.hint?.root.setPosition(cx, playY - cfg.hintAbovePlay - offerRoom);
  }

  private setEnabled(enabled: boolean): void {
    this.play.setEnabled(enabled);
    this.startFrom.setEnabled(enabled);
    this.nav.setEnabled(enabled);
    this.badges.setEnabled(enabled);
    this.shelf.setEnabled(enabled);
    this.hint?.setEnabled(enabled);
    this.starter.setEnabled(enabled);
    this.oven.setEnabled(enabled);
    setLevelPlateEnabled(this.level, enabled);
  }

  /** Leaves the screen once (no double taps), then runs `next`. */
  private goTo(next: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.setEnabled(false);
    leaveScreen(this, this.content(), next);
  }

  /** The badges and the dots of the nav bar follow the save again. */
  private refreshMarks(): void {
    refreshLevelPlate(this.level);
    this.badges.refreshStreak();
    this.nav.refresh();
  }

  /** The settings window; a language change rebuilds this screen and opens the window again, a reset starts the first run. */
  private openSettings(): void {
    this.settings = openSettingsWindow(this, {
      onLanguage: () => {
        if (this.leaving) return;
        this.scene.restart({
          reopenSettings: true,
          highlightPlay: this.highlightPlay,
        } satisfies HomeData);
      },
      onReset: () => void this.restartFresh(),
    });
  }

  /** After a reset: the store gives back what was paid for, then the game starts like the first launch. */
  private async restartFresh(): Promise<void> {
    if (this.leaving) return;
    this.leaving = true;
    this.settings?.destroy();
    this.settings = null;
    this.setEnabled(false);
    await syncPurchases();
    leaveScreen(this, [], () => startRunFrom(this));
  }

  /** Every entry: the threat window and the streak calendar (first of the day), then the "No ads" offer when it is due. */
  private showDayEntry(): void {
    if (this.leaving) return;
    const offer = prepareRemoveAdsOffer();
    openStreakEntry(this, this.header.wallet, (claim) => {
      this.afterStreak(claim);
      if (this.leaving) return;
      // The oven explainer comes once, first; the offer follows when it closes.
      if (gameState.hasHint('oven')) offer.open(this);
      else openOvenWindow(this, () => offer.open(this));
    });
  }

  /** A creature of the calendar (day 7) is shown on its own screen, then Home comes back. */
  private afterStreak(claim: StreakClaim | null): void {
    this.refreshMarks();
    if (claim?.reward.kind !== 'creature' || claim.duplicate) return;
    this.showNewCreatures([claim.reward.id]);
  }

  /** The missions window closed: creatures of a level reached there get their own screen. */
  private afterMissions(creatures: CreatureId[]): void {
    this.refreshMarks();
    if (creatures.length > 0) this.showNewCreatures(creatures);
  }

  /** New creatures get their own screen, then Home comes back. */
  private showNewCreatures(creatures: CreatureId[]): void {
    this.goTo(() =>
      openScreen(this, SCENES.newCreature, {
        creatures,
        then: { kind: 'screen', key: SCENES.home },
      }),
    );
  }

  private startRun(request?: RunRequest): void {
    this.ring?.destroy();
    this.ring = null;
    this.goTo(() => startRunFrom(this, request));
  }
}
