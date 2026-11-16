import * as Phaser from 'phaser';
import { CREATURES, type CreatureId } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { MASTER_ANIM } from '../../data/master-anim';
import type { TeamSlot } from '../../core/sim-types';
import { getLang } from '../../i18n';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { easeFn } from '../fx/ease';
import { FX_TEXTURES } from '../fx/fx-textures';
import { creatureBadge } from './effect-badge-state';
import type { EffectBadges } from './effect-badges';
import {
  captionLook,
  captionPlace,
  idleCaption,
  noteCaption,
  stackCaption,
  stepCaption,
  type CaptionLook,
  type CaptionPlace,
  type MasterFeed,
} from './master-caption-state';
import { bakeCaptionArt } from './master-caption-art';

const cfg = MASTER_ANIM.caption;
const inEase = easeFn(cfg.inEase);

/**
 * The caption of one creature: one baked picture on the shared atlas (plate, gold star and the
 * name of its master effect) and the spark of its star. No text of its own: the coins a master
 * effect pays fly to the coin counter, and a text would cost a draw of its own texture. Everything
 * is made at the start of the run, so nothing is created while it goes on.
 */
class CaptionView {
  readonly state = idleCaption();
  readonly root: Phaser.GameObjects.Container;
  private readonly spark: Phaser.GameObjects.Image;
  readonly width: number;
  private sparkMs = Infinity;

  constructor(
    scene: Phaser.Scene,
    readonly creature: CreatureId,
  ) {
    const art = bakeCaptionArt(scene, creature, getLang());
    this.width = art.width;
    const plate = scene.add.image(0, 0, art.key);
    this.spark = scene.add
      .image(-art.width / 2 + cfg.padX + cfg.starSize / 2, 0, FX_TEXTURES.star)
      .setTint(0xffffff)
      .setDisplaySize(cfg.starSize, cfg.starSize)
      .setVisible(false);
    this.root = scene.add
      .container(0, 0, [plate, this.spark])
      .setDepth(DEPTH.floatText)
      .setVisible(false);
  }

  note(): void {
    if (noteCaption(this.state)) this.sparkMs = 0;
  }

  /** Showing, or about to (it takes a place of the stack). */
  get active(): boolean {
    return this.state.phase !== 'idle';
  }

  update(dtMs: number, place: CaptionPlace, look: CaptionLook): void {
    stepCaption(this.state, dtMs);
    captionLook(this.state, effectsMode.reduced, inEase, look);
    const visible = this.state.phase !== 'idle' && look.alpha > 0;
    this.root.setVisible(visible);
    if (!visible) return;
    // The container is centred on the plate, so the pop scales around its middle.
    this.root
      .setPosition(place.left + this.width / 2, place.y)
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
  /** Lines the captions of this frame took (see `stackCaption`). */
  private readonly taken: number[] = [];

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
      this.views.get(note.creature)?.note();
    });
    this.taken.length = 0;
    for (const view of this.views.values()) {
      const index = badges.indexOf(creatureBadge(view.creature));
      captionPlace(index, badges.count, view.width, this.place);
      // Captions shown together do not sit on each other.
      if (view.active) stackCaption(this.place, this.taken);
      view.update(dtMs, this.place, this.look);
    }
  }

  clear(): void {
    for (const view of this.views.values()) view.destroy();
    this.views = new Map();
  }
}
