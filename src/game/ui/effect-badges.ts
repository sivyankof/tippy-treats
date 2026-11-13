import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { formatNumber } from '../../i18n';
import { frameLerp } from '../../util/math';
import { easeFn } from '../fx/ease';
import { createCreatureIcon, setCreatureIcon } from './creature-icons';
import {
  badgeCreature,
  BadgeTracker,
  badgeVisual,
  type BadgeState,
  type BadgeVisual,
} from './effect-badge-state';
import { createStrokedText } from './outlined-text';
import type { ActiveEffect } from '../../core/abilities/types';

const { badgeSize, badgeGap, badgeMargin, badgeRowY, badgeCounterFont, badgeCounterInset } =
  HUD_LAYOUT;
const { badges } = ANIM;
const inEase = easeFn(badges.inEase);
const counterEase = easeFn(badges.counterPopEase);
const COUNTER_OFFSET = badgeSize / 2 - badgeCounterInset;
/** A slot that is within this many pixels of its place counts as there. */
const SETTLE_EPSILON = 0.5;

/** A pooled badge: icon and counter in a container that scales around the icon centre. */
class BadgeSlot {
  readonly root: Phaser.GameObjects.Container;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly counter: Phaser.GameObjects.Text;
  private key: BadgeState['key'] | null = null;
  private shownCount = -1;

  constructor(scene: Phaser.Scene) {
    this.icon = createCreatureIcon(scene, 0, 0);
    this.counter = createStrokedText(
      scene,
      COUNTER_OFFSET,
      COUNTER_OFFSET,
      '',
      badgeCounterFont,
      PALETTE.textLight,
      PALETTE.textDark,
      HUD_LAYOUT.badgeCounterStroke,
    );
    this.root = scene.add.container(0, badgeRowY, [this.icon, this.counter]).setVisible(false);
  }

  /** Shows the badge for its state; picture and text change only when they differ from the last call. */
  show(badge: Readonly<BadgeState>, visual: Readonly<BadgeVisual>): void {
    if (badge.key !== this.key) {
      this.key = badge.key;
      setCreatureIcon(this.icon, badgeCreature(badge.key));
    }
    if (badge.layersLeft !== this.shownCount) {
      this.shownCount = badge.layersLeft;
      this.counter.setText(formatNumber(badge.layersLeft));
    }
    const pop =
      badge.counterAgeMs < badges.counterPopMs
        ? 1 +
          (badges.counterPopScale - 1) * (1 - counterEase(badge.counterAgeMs / badges.counterPopMs))
        : 1;
    this.counter.setScale(pop);
    this.root
      .setScale(visual.scale)
      .setAlpha(visual.alpha)
      .setVisible(visual.scale > 0);
  }

  hide(): void {
    this.key = null;
    this.shownCount = -1;
    this.root.setVisible(false);
  }
}

/**
 * The row of active effects: a creature icon with the layers left for every effect and for the
 * brownie shield. Slots are pooled and updated in place, so a frame allocates nothing.
 */
export class EffectBadges {
  private readonly tracker = new BadgeTracker();
  private readonly slots: BadgeSlot[] = [];
  private readonly visual: BadgeVisual = { scale: 1, alpha: 1 };
  constructor(private readonly scene: Phaser.Scene) {}

  /** Left edge of the row; badges follow each other to the right. */
  private targetX(index: number): number {
    return badgeMargin + badgeSize / 2 + index * (badgeSize + badgeGap);
  }

  update(effects: readonly ActiveEffect[], shield: number, timeMs: number, deltaMs: number): void {
    this.tracker.sync(effects, shield);
    this.tracker.step(deltaMs);
    const items = this.tracker.items;
    const k = frameLerp(badges.slideLerp, deltaMs);
    for (let i = 0; i < items.length; i++) {
      const badge = items[i];
      if (!badge) continue;
      const slot = (this.slots[i] ??= new BadgeSlot(this.scene));
      const target = this.targetX(i);
      // A new badge starts in place; the others slide over when one before them leaves.
      const x = Number.isNaN(badge.x) ? target : badge.x + (target - badge.x) * k;
      badge.x = Math.abs(target - x) < SETTLE_EPSILON ? target : x;
      slot.root.setX(badge.x);
      slot.show(badge, badgeVisual(badge, timeMs, inEase, this.visual));
    }
    for (let i = items.length; i < this.slots.length; i++) {
      this.slots[i]?.hide();
    }
  }
}
