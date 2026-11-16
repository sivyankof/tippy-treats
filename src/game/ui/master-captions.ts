import * as Phaser from 'phaser';
import { CREATURES, type CreatureId } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { MASTER_ANIM } from '../../data/master-anim';
import { PALETTE } from '../../data/palette';
import type { TeamSlot } from '../../core/sim-types';
import { formatNumber, getLang, t } from '../../i18n';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { easeFn } from '../fx/ease';
import { FX_TEXTURES } from '../fx/fx-textures';
import type { EffectBadges } from './effect-badges';
import {
  captionLook,
  captionPlace,
  idleCaption,
  noteCaption,
  stepCaption,
  type CaptionLook,
  type CaptionPlace,
  type MasterFeed,
} from './master-caption-state';
import { createStrokedText } from './outlined-text';
import { bakeCaptionArt } from './master-caption-art';

const cfg = MASTER_ANIM.caption;
const inEase = easeFn(cfg.inEase);

/**
 * The caption of one creature: one baked picture (plate, gold star and the name of its master
 * effect) and, when the effect paid coins, their sum as a text beside it. Everything is made at
 * the start of the run, so nothing is created while it goes on.
 */
class CaptionView {
  readonly state = idleCaption();
  readonly root: Phaser.GameObjects.Container;
  private readonly sum: Phaser.GameObjects.Text;
  private readonly spark: Phaser.GameObjects.Image;
  private readonly plateWidth: number;
  private readonly sumWidth: number;
  private sparkMs = Infinity;
  private shownCoins = -1;

  constructor(
    scene: Phaser.Scene,
    readonly creature: CreatureId,
  ) {
    const art = bakeCaptionArt(scene, creature, getLang());
    this.plateWidth = art.width;
    const plate = scene.add.image(0, 0, art.key);
    this.sum = createStrokedText(
      scene,
      0,
      0,
      '',
      cfg.sumFont,
      cfg.gold,
      PALETTE.textDark,
      cfg.nameStroke,
    ).setOrigin(0, 0.5);
    // Measured once with the widest sum it has to hold.
    this.sum.setText(t('mastery.plus', { n: '9'.repeat(cfg.sumDigits) }));
    this.sumWidth = this.sum.width;
    this.sum.setText('');
    this.sum.setX(art.width / 2 + cfg.starGap);
    this.spark = scene.add
      .image(-art.width / 2 + cfg.padX + cfg.starSize / 2, 0, FX_TEXTURES.star)
      .setTint(0xffffff)
      .setDisplaySize(cfg.starSize, cfg.starSize)
      .setVisible(false);
    this.root = scene.add
      .container(0, 0, [plate, this.spark, this.sum])
      .setDepth(DEPTH.floatText)
      .setVisible(false);
  }

  note(coins: number): void {
    const fresh = noteCaption(this.state, coins);
    if (fresh) this.sparkMs = 0;
  }

  /** Width the caption takes now: the plate, and the sum beside it while coins are shown. */
  get width(): number {
    return this.state.coins > 0 ? this.plateWidth + cfg.starGap + this.sumWidth : this.plateWidth;
  }

  update(dtMs: number, place: CaptionPlace, look: CaptionLook): void {
    stepCaption(this.state, dtMs);
    captionLook(this.state, effectsMode.reduced, inEase, look);
    const visible = this.state.phase !== 'idle' && look.alpha > 0;
    this.root.setVisible(visible);
    if (!visible) return;
    const withSum = this.state.coins > 0;
    if (this.state.coins !== this.shownCoins) {
      this.shownCoins = this.state.coins;
      this.sum.setText(withSum ? t('mastery.plus', { n: formatNumber(this.state.coins) }) : '');
    }
    this.sum.setVisible(withSum);
    // The container is centred on the plate, so the pop scales around its middle.
    this.root
      .setPosition(place.left + this.plateWidth / 2, place.y)
      .setScale(look.scale)
      .setAlpha(look.alpha);
    this.runSpark(dtMs);
  }

  private runSpark(dtMs: number): void {
    const { ms, scaleTo, spinDeg } = cfg.spark;
    if (effectsMode.atMost('lite') || this.sparkMs >= ms) {
      this.spark.setVisible(false);
      return;
    }
    this.sparkMs += dtMs;
    const k = Math.min(1, this.sparkMs / ms);
    const size = cfg.starSize * (1 + (scaleTo - 1) * k);
    this.spark
      .setVisible(true)
      .setDisplaySize(size, size)
      .setAngle(spinDeg * k)
      .setAlpha(1 - k);
  }

  destroy(): void {
    this.root.destroy();
  }
}

/**
 * The master captions of the HUD: one gold plate per team creature that has a master effect
 * (level 5), prepared when the run starts. A `mastery` event shows the plate of its creature next
 * to that creature's badge of the effect row (or under the row, see `captionPlace`).
 */
export class MasterCaptions {
  private views = new Map<CreatureId, CaptionView>();
  private team: readonly (TeamSlot | null)[] | null = null;
  private readonly place: CaptionPlace = { left: 0, y: 0 };
  private readonly look: CaptionLook = { scale: 1, alpha: 0 };

  constructor(private readonly scene: Phaser.Scene) {}

  /** Prepares the plates for the creatures of `team` at the master level (once per run). */
  prepare(team: readonly (TeamSlot | null)[]): void {
    if (team === this.team) return;
    this.team = team;
    this.clear();
    for (const slot of team) {
      if (slot && slot.level >= MASTERY.masterLevel) this.ensure(slot.id);
    }
  }

  /** The plate of `id`, made on the spot when the team has none (the debug hook only). */
  ensure(id: CreatureId): void {
    if (!this.views.has(id) && CREATURES[id]) this.views.set(id, new CaptionView(this.scene, id));
  }

  update(feed: MasterFeed, badges: EffectBadges, dtMs: number): void {
    feed.drain((note) => {
      // A creature the team does not have at the master level shows a caption only in dev (the debug hook).
      if (import.meta.env.DEV) this.ensure(note.creature);
      this.views.get(note.creature)?.note(note.coins);
    });
    for (const view of this.views.values()) {
      // The brownie's badge is the shield's.
      const index = badges.indexOf(view.creature === 'brownie' ? 'shield' : view.creature);
      captionPlace(index, badges.count, view.width, this.place);
      view.update(dtMs, this.place, this.look);
    }
  }

  clear(): void {
    for (const view of this.views.values()) view.destroy();
    this.views = new Map();
  }
}
