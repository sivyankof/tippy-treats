import * as Phaser from 'phaser';
import { canFillTeam } from '../../core/team';
import { ANIM } from '../../data/anim';
import type { CreatureId } from '../../data/creatures';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { gameState } from '../../state';
import { prepareRemoveAdsOffer } from '../interstitial-flow';
import { buyProduct, loadPrices, syncPurchases } from '../purchases';
import { starterPackContents } from '../../core/shop';
import { startRunFrom, openScreen, SCENES, type HomeData } from '../scene-keys';
import type { PopupWindow } from '../ui/style/dialog-window';
import { createTextButton, type Button } from '../ui/button';
import { createHintBubble } from '../ui/menu/home-hint';
import { HomeBadges } from '../ui/menu/home-badges';
import { HomeNav } from '../ui/menu/home-nav';
import { createLevelPlate, createPlayRing, createRecordPlate } from '../ui/menu/home-plates';
import { HomeShelf } from '../ui/menu/home-shelf';
import { openGiftWindow } from '../ui/menu/gift-window';
import { openMissionsWindow } from '../ui/menu/missions-window';
import { openSettingsWindow } from '../ui/menu/settings-window';
import { ScreenHeader } from '../ui/menu/screen-header';
import { openStreakCalendar, openStreakEntry } from '../ui/menu/streak-windows';
import type { StreakClaim } from '../../state/game-state';
import { MenuScenery } from '../ui/style/menu-scenery';
import { enterScreen, leaveScreen, type Movable } from '../ui/transition';

const cfg = MENU.home;

/**
 * The main screen, in the kitchen of the run: the level and the wallet on top, the team on its
 * shelf under a warm light, the record, the big Play button and the bottom bar.
 */
export class HomeScene extends Phaser.Scene {
  private scenery!: MenuScenery;
  private header!: ScreenHeader;
  private level!: Phaser.GameObjects.Container;
  private shelf!: HomeShelf;
  private record!: Phaser.GameObjects.Container;
  private play!: Button;
  private nav!: HomeNav;
  private badges!: HomeBadges;
  private hint: ReturnType<typeof createHintBubble> | null = null;
  private ring: Phaser.GameObjects.Container | null = null;
  private starter: Button | null = null;
  /** Room above Play is kept for the starter pack button while the offer is on (the hint bubble stands above it). */
  private offerRoom = false;
  private buying = false;
  private leaving = false;
  /** Kept so a language restart redraws the ring on Play. */
  private highlightPlay = false;
  private settings: PopupWindow | null = null;

  constructor() {
    super(SCENES.home);
  }

  create(data?: HomeData): void {
    this.leaving = false;
    this.settings = null;
    this.highlightPlay = data?.highlightPlay ?? false;
    gameState.refreshDay();
    this.hint = null;
    this.ring = null;
    this.starter = null;
    this.buying = false;
    this.offerRoom = gameState.starterPackOffered;
    this.scenery = new MenuScenery(this, 'home');
    this.shelf = new HomeShelf(this, () => this.goTo(() => openScreen(this, SCENES.team)));
    this.record = createRecordPlate(this);
    this.nav = new HomeNav(this, {
      shop: () => this.goTo(() => openScreen(this, SCENES.shop)),
      collection: () => this.goTo(() => openScreen(this, SCENES.collection)),
      play: () => this.startRun(),
      daily: () => this.goTo(() => openScreen(this, SCENES.daily)),
      missions: () => openMissionsWindow(this, () => this.refreshMarks(), this.header.wallet),
    });
    this.badges = new HomeBadges(this, {
      streak: () =>
        openStreakCalendar(this, (claim) => this.afterStreak(claim), this.header.wallet),
      gift: () => openGiftWindow(this, () => this.refreshMarks(), this.header.wallet),
      settings: () => this.openSettings(),
    });
    this.level = createLevelPlate(this);
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
    if (this.highlightPlay) this.ring = createPlayRing(this);
    if (this.offerRoom) void this.addStarterOffer();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    this.setEnabled(false);
    enterScreen(this, this.content(), () => {
      this.setEnabled(true);
      if (data?.reopenSettings) this.openSettings();
      else this.showDayEntry();
    });
  }

  override update(time: number, delta: number): void {
    this.scenery.update(delta);
    this.header.update(time, delta);
    this.shelf.update(delta);
    this.badges.update();
  }

  /** Everything that slides with the screen; the scenery stays. */
  private content(): Movable[] {
    const items: Movable[] = [
      this.level,
      ...this.badges.parts,
      ...this.header.parts,
      this.shelf.root,
      this.record,
    ];
    if (this.hint) items.push(this.hint.root);
    if (this.ring) items.push(this.ring);
    if (this.starter) items.push(this.starter);
    items.push(this.play, ...this.nav.parts);
    return items;
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    const extra = Math.max(0, height - cfg.baseHeight) * cfg.extraShare;
    this.cameras.main.setSize(width, height);
    this.scenery.resize(width, height);
    this.header.layout(width);
    this.badges.layout(width);
    this.level.setPosition(cfg.levelPlate.left + cfg.levelPlate.width / 2, cfg.levelPlate.y);
    const shelfY = cfg.shelf.y + extra;
    this.shelf.root.setPosition(cx, shelfY);
    this.record.setPosition(cx, cfg.record.y + extra * cfg.record.extraShare);
    const navTop = this.nav.layout(width, height);
    const playY = navTop - cfg.playAboveNav - cfg.playHeight / 2;
    this.play.setPosition(cx, playY);
    this.ring?.setPosition(cx, playY);
    const offerRoom = this.offerRoom ? cfg.starter.height + cfg.starter.gap : 0;
    this.starter?.setPosition(
      cx,
      playY - cfg.playHeight / 2 - cfg.starter.gap - cfg.starter.height / 2,
    );
    this.hint?.root.setPosition(cx, playY - cfg.hintAbovePlay - offerRoom);
  }

  private setEnabled(enabled: boolean): void {
    this.play.setEnabled(enabled);
    this.nav.setEnabled(enabled);
    this.badges.setEnabled(enabled);
    this.shelf.setEnabled(enabled);
    this.hint?.setEnabled(enabled);
    this.starter?.setEnabled(enabled && !this.buying);
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
      if (!this.leaving) offer.open(this);
    });
  }

  /** A creature of the calendar (day 7) is shown on its own screen, then Home comes back. */
  private afterStreak(claim: StreakClaim | null): void {
    this.refreshMarks();
    if (claim?.reward.kind !== 'creature' || claim.duplicate) return;
    this.showNewCreature(claim.reward.id);
  }

  /** The starter pack button, once the store has told its price; it is not shown for a product without one. */
  private async addStarterOffer(): Promise<void> {
    const price = (await loadPrices()).starter_pack;
    if (!this.scene.isActive() || this.leaving || this.starter) return;
    if (price === undefined) {
      this.offerRoom = false;
      this.layout();
      return;
    }
    const { width, height, radius, shadowOffset, font, pad } = cfg.starter;
    this.starter = createTextButton(this, {
      text: t('home.starter', { price }),
      font,
      maxLabelWidth: width - pad,
      fill: PALETTE.gold,
      layout: { width, height, radius, shadowOffset },
      keyPrefix: 'ui_home_starter',
      onClick: () => void this.buyStarter(),
    }).button.breathe(false);
    this.layout();
    this.starter.setAlpha(0);
    this.tweens.add({ targets: this.starter, alpha: 1, duration: ANIM.ui.transition.inMs });
  }

  /** Buys the pack through the store; a new creature gets its own screen, then Home comes back. */
  private async buyStarter(): Promise<void> {
    if (this.buying || this.leaving) return;
    const creature = starterPackContents(gameState.data.creatures).creature;
    this.buying = true;
    this.starter?.setEnabled(false);
    const outcome = await buyProduct('starter_pack');
    this.buying = false;
    if (!this.scene.isActive()) return;
    if (outcome !== 'purchased') {
      this.starter?.setEnabled(!this.leaving);
      return;
    }
    this.starter?.destroy();
    this.starter = null;
    this.offerRoom = false;
    this.layout();
    this.refreshMarks();
    if (creature !== null) this.showNewCreature(creature);
  }

  /** A new creature gets its own screen, then Home comes back. */
  private showNewCreature(id: CreatureId): void {
    this.goTo(() =>
      openScreen(this, SCENES.newCreature, {
        creatures: [id],
        then: { kind: 'screen', key: SCENES.home },
      }),
    );
  }

  private startRun(): void {
    this.ring?.destroy();
    this.ring = null;
    this.goTo(() => startRunFrom(this));
  }
}
