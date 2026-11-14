import * as Phaser from 'phaser';
import { canFillTeam } from '../../core/team';
import { MENU } from '../../data/menu-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { gameState } from '../../state';
import { startRunFrom, openScreen, SCENES, type HomeData } from '../scene-keys';
import { createTextButton, type Button } from '../ui/button';
import { createHintBubble } from '../ui/menu/home-hint';
import { HomeNav } from '../ui/menu/home-nav';
import { createLevelPlate, createRecordPlate } from '../ui/menu/home-plates';
import { HomeShelf } from '../ui/menu/home-shelf';
import { ScreenHeader } from '../ui/menu/screen-header';
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
  private hint: ReturnType<typeof createHintBubble> | null = null;
  private ring: Phaser.GameObjects.Container | null = null;
  private leaving = false;

  constructor() {
    super(SCENES.home);
  }

  create(data?: HomeData): void {
    this.leaving = false;
    this.hint = null;
    this.ring = null;
    this.scenery = new MenuScenery(this, 'home');
    this.shelf = new HomeShelf(this, () => this.goTo(() => openScreen(this, SCENES.team)));
    this.record = createRecordPlate(this);
    this.nav = new HomeNav(this, {
      collection: () => this.goTo(() => openScreen(this, SCENES.collection)),
      play: () => this.startRun(),
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
    if (data?.highlightPlay) this.ring = this.createRing();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    this.setEnabled(false);
    enterScreen(this, this.content(), () => this.setEnabled(true));
  }

  override update(time: number, delta: number): void {
    this.scenery.update(delta);
    this.header.update(time, delta);
    this.shelf.update(delta);
  }

  /** Everything that slides with the screen; the scenery stays. */
  private content(): Movable[] {
    const items: Movable[] = [this.level, ...this.header.parts, this.shelf.root, this.record];
    if (this.hint) items.push(this.hint.root);
    if (this.ring) items.push(this.ring);
    items.push(this.play, ...this.nav.parts);
    return items;
  }

  /** A ring around Play that grows and fades again and again, until Play is pressed. */
  private createRing(): Phaser.GameObjects.Container {
    const { width, grow, ms, pad } = cfg.highlightRing;
    const g = this.add.graphics();
    const w = cfg.playWidth + pad * 2;
    const h = cfg.playHeight + pad * 2;
    g.lineStyle(width, PALETTE.gold, 1).strokeRoundedRect(
      -w / 2,
      -h / 2,
      w,
      h,
      cfg.playRadius + pad,
    );
    const holder = this.add.container(0, 0, [g]);
    this.tweens.add({
      targets: g,
      scale: grow,
      alpha: 0,
      duration: ms,
      ease: 'Sine.easeOut',
      repeat: -1,
    });
    return holder;
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    const extra = Math.max(0, height - cfg.baseHeight) * cfg.extraShare;
    this.cameras.main.setSize(width, height);
    this.scenery.resize(width, height);
    this.header.layout(width);
    this.level.setPosition(cfg.levelPlate.left + cfg.levelPlate.width / 2, cfg.levelPlate.y);
    const shelfY = cfg.shelf.y + extra;
    this.shelf.root.setPosition(cx, shelfY);
    this.record.setPosition(cx, cfg.record.y + extra * cfg.record.extraShare);
    const navTop = this.nav.layout(width, height);
    const playY = navTop - cfg.playAboveNav - cfg.playHeight / 2;
    this.play.setPosition(cx, playY);
    this.ring?.setPosition(cx, playY);
    this.hint?.root.setPosition(cx, playY - cfg.hintAbovePlay);
  }

  private setEnabled(enabled: boolean): void {
    this.play.setEnabled(enabled);
    this.nav.setEnabled(enabled);
    this.shelf.setEnabled(enabled);
    this.hint?.setEnabled(enabled);
  }

  /** Leaves the screen once (no double taps), then runs `next`. */
  private goTo(next: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.setEnabled(false);
    leaveScreen(this, this.content(), next);
  }

  private startRun(): void {
    this.ring?.destroy();
    this.ring = null;
    this.goTo(() => startRunFrom(this));
  }
}
