import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import type { Button } from '../../common/button';
import { createOutlinedText } from '../../common/outlined-text';
import { RefitPlate } from '../../style/refit-plate';
import type { VolumePlate } from '../../style/volume';
import { fitText } from '../widgets/fit-text';
import { createIconButton, type IconKind } from '../widgets/icon-button';
import {
  dailyWaiting,
  missionDots,
  missionsWaiting,
  NavMarks,
  shopWaiting,
} from './home-nav-marks';

const cfg = MENU.home;

interface NavSpec {
  icon: IconKind;
  label: string;
  fill: number;
  size: number;
  onClick: () => void;
}

/** One item of the bottom bar: a round icon button and its caption. */
class NavItem {
  readonly root: Phaser.GameObjects.Container;
  readonly button: Button;
  readonly marks: NavMarks;

  constructor(scene: Phaser.Scene, spec: NavSpec, slotWidth: number) {
    this.button = createIconButton(scene, 0, 0, spec.size, spec.fill, spec.icon, spec.onClick);
    const caption = fitText(
      createOutlinedText(scene, 0, spec.size / 2 + cfg.navCaptionGap, spec.label, cfg.navFont),
      slotWidth,
    ).setOrigin(0.5, 0);
    this.root = scene.add.container(0, 0, [this.button, caption]);
    this.marks = new NavMarks(scene, this.root, spec.size);
  }
}

/** The bottom navigation bar of Home: Shop, Collection, Play, Daily, Missions on a glossy bar. */
export class HomeNav {
  private readonly items: NavItem[];
  private readonly bar: RefitPlate;

  constructor(
    scene: Phaser.Scene,
    handlers: {
      shop: () => void;
      collection: () => void;
      play: () => void;
      daily: () => void;
      missions: () => void;
    },
  ) {
    const slotWidth = cfg.navSlotWidth;
    const specs: NavSpec[] = [
      {
        icon: 'shop',
        label: t('home.nav.shop'),
        fill: PALETTE.accentSecondary,
        size: cfg.navSize,
        onClick: handlers.shop,
      },
      {
        icon: 'collection',
        label: t('home.nav.collection'),
        fill: PALETTE.accentSecondary,
        size: cfg.navSize,
        onClick: handlers.collection,
      },
      {
        icon: 'play',
        label: t('home.nav.play'),
        fill: PALETTE.accent,
        size: cfg.navPlaySize,
        onClick: handlers.play,
      },
      {
        icon: 'daily',
        label: t('home.nav.daily'),
        fill: PALETTE.accentSecondary,
        size: cfg.navSize,
        onClick: handlers.daily,
      },
      {
        icon: 'missions',
        label: t('home.nav.missions'),
        fill: PALETTE.accentSecondary,
        size: cfg.navSize,
        onClick: handlers.missions,
      },
    ];
    const { height, overhang } = cfg.navBar;
    this.bar = new RefitPlate(scene, 'bar', height + overhang);
    this.items = specs.map((spec) => new NavItem(scene, spec, slotWidth));
    this.refresh();
  }

  /** The progress dots of Missions and the red dots of Missions and Daily follow the save. */
  refresh(): void {
    const [shop, , , daily, missions] = this.items;
    shop?.marks.setAlert(shopWaiting());
    missions?.marks.setDots(missionDots());
    missions?.marks.setAlert(missionsWaiting());
    daily?.marks.setAlert(dailyWaiting());
  }

  /** What slides in with the screen. */
  get parts(): Array<Phaser.GameObjects.Container | VolumePlate> {
    return [this.bar.plate, ...this.items.map((item) => item.root)];
  }

  /**
   * The bar along the bottom of a `width` x `height` screen (its ends and bottom run past the
   * edges) and five equal columns of buttons on it. The buttons stand above `safeBottom` (the
   * top of the safe band at the bottom, `height` without one); the bar itself runs on under it
   * to the screen edge. Returns the top of the bar.
   */
  layout(width: number, height: number, safeBottom = height): number {
    const { height: barHeight, overhang, padTop } = cfg.navBar;
    const top = safeBottom - barHeight;
    const reach = barHeight + (height - safeBottom) + overhang;
    this.bar
      .setBodyHeight(reach)
      .setBodyWidth(width + overhang * 2)
      .setPosition(width / 2, top + reach / 2);
    const y = top + padTop + cfg.navSize / 2;
    const step = width / this.items.length;
    this.items.forEach((item, i) => item.root.setPosition(step * (i + 0.5), y));
    return top;
  }

  setEnabled(enabled: boolean): void {
    for (const item of this.items) item.button.setEnabled(enabled);
  }
}
