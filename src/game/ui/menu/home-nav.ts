import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { t } from '../../../i18n';
import type { Button } from '../button';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { fitText } from './fit-text';
import { createIconButton, type IconKind } from './icon-button';

const cfg = MENU.home;

interface NavSpec {
  icon: IconKind;
  label: string;
  fill: number;
  size: number;
  /** Null: the screen is not built yet. */
  onClick: (() => void) | null;
}

/** One item of the bottom bar: a round icon button, its caption and maybe a "soon" badge. */
class NavItem {
  readonly root: Phaser.GameObjects.Container;
  readonly button: Button;
  readonly live: boolean;

  constructor(scene: Phaser.Scene, spec: NavSpec, slotWidth: number) {
    this.live = spec.onClick !== null;
    this.button = createIconButton(
      scene,
      0,
      0,
      spec.size,
      spec.fill,
      spec.icon,
      spec.onClick ?? (() => undefined),
    );
    const caption = fitText(
      createOutlinedText(scene, 0, spec.size / 2 + cfg.navCaptionGap, spec.label, cfg.navFont),
      slotWidth,
    ).setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [this.button, caption];
    if (!this.live) {
      this.button.setEnabled(false);
      const { width, height, font, offsetY, fill } = cfg.navBadge;
      const y = -spec.size / 2 - offsetY;
      const badge = new VolumePlate(scene, 'chip', height, { fill }).setBodyWidth(width).setY(y);
      const text = fitText(
        createOutlinedText(scene, 0, y + faceOffsetY('chip'), t('meta.soon'), font),
        width,
      );
      parts.push(badge, text);
    }
    this.root = scene.add.container(0, 0, parts);
    if (!this.live) this.button.setAlpha(cfg.navDisabledAlpha);
  }
}

/** The bottom navigation bar of Home: Shop, Collection, Play, Daily, Missions on a glossy bar. */
export class HomeNav {
  private readonly items: NavItem[];
  private readonly bar: VolumePlate;

  constructor(scene: Phaser.Scene, handlers: { collection: () => void; play: () => void }) {
    const slotWidth = cfg.navSlotWidth;
    const specs: NavSpec[] = [
      {
        icon: 'shop',
        label: t('home.nav.shop'),
        fill: PALETTE.accentSecondary,
        size: cfg.navSize,
        onClick: null,
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
        onClick: null,
      },
      {
        icon: 'missions',
        label: t('home.nav.missions'),
        fill: PALETTE.accentSecondary,
        size: cfg.navSize,
        onClick: null,
      },
    ];
    const { height, overhang } = cfg.navBar;
    this.bar = new VolumePlate(scene, 'bar', height + overhang);
    this.items = specs.map((spec) => new NavItem(scene, spec, slotWidth));
  }

  /** What slides in with the screen. */
  get parts(): Array<Phaser.GameObjects.Container | VolumePlate> {
    return [this.bar, ...this.items.map((item) => item.root)];
  }

  /**
   * The bar along the bottom of a `width` x `height` screen (its ends and bottom run past the
   * edges) and five equal columns of buttons on it. Returns the top of the bar.
   */
  layout(width: number, height: number): number {
    const { height: barHeight, overhang, padTop } = cfg.navBar;
    const top = height - barHeight;
    this.bar
      .setBodyWidth(width + overhang * 2)
      .setPosition(width / 2, top + (barHeight + overhang) / 2);
    const y = top + padTop + cfg.navSize / 2;
    const step = width / this.items.length;
    this.items.forEach((item, i) => item.root.setPosition(step * (i + 0.5), y));
    return top;
  }

  setEnabled(enabled: boolean): void {
    for (const item of this.items) {
      if (item.live) item.button.setEnabled(enabled);
    }
  }
}
