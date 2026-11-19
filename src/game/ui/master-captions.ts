import * as Phaser from 'phaser';
import { CREATURES, type CreatureId } from '../../data/creatures/creatures';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { MASTERY } from '../../data/creatures/mastery';
import { MASTER_ANIM } from '../../data/creatures/master-anim';
import type { TeamSlots } from '../../core/tower/sim-types';
import { getLang } from '../../i18n';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { easeFn } from '../fx/common/ease';
import { FX_TEXTURES } from '../fx/common/fx-textures';
import {
  captionLook,
  endCaption,
  idleCaption,
  noteCaption,
  stepCaption,
  type CaptionLook,
  type MasterFeed,
} from './master-caption-state';
import { captionSpot, type CaptionSpot } from './hud-row-layout';
import { LOGICAL_SIZE } from '../../data/app/screen';
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

  /** Showing, or about to. */
  get active(): boolean {
    return this.state.phase !== 'idle';
  }

  /** Drops the caption at once. */
  end(): void {
    endCaption(this.state);
    this.sparkMs = Infinity;
    this.root.setVisible(false);
  }

  /** True while the plate is on screen. */
  get visible(): boolean {
    return this.root.visible;
  }

  update(dtMs: number, spot: CaptionSpot, look: CaptionLook): void {
    stepCaption(this.state, dtMs);
    captionLook(this.state, effectsMode.reduced, inEase, look);
    const visible = this.state.phase !== 'idle' && look.alpha > 0;
    this.root.setVisible(visible);
    if (!visible) return;
    // The container is centred on the plate, so the pop scales around its middle.
    this.root
      .setPosition(spot.centreX, HUD_LAYOUT.badgeRowY)
      .setScale(look.scale * spot.scale)
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
 * (level 5), prepared when the run starts. A `mastery` event shows the plate of its creature at
 * the right end of the badge row strip, where the next-creature chip stands (`captionSpot`). One
 * caption at a time: a note of another creature replaces the showing one at once (and sparks);
 * a repeat of the same creature extends its hold.
 */
export class MasterCaptions {
  private views = new Map<CreatureId, CaptionView>();
  private team: TeamSlots | null = null;
  private readonly spot: CaptionSpot = { centreX: 0, scale: 1 };
  private readonly look: CaptionLook = { scale: 1, alpha: 0 };
  private current: CaptionView | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** True while a caption is on screen: the next-creature chip gives way to it. */
  get showing(): boolean {
    return this.current?.visible === true;
  }

  /** Prepares the plates for the creatures of `team` at the master level (once per run). */
  prepare(team: TeamSlots): void {
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

  /** `badgeCount` is the badges in the row: the plate shrinks rather than cover them. */
  update(feed: MasterFeed, badgeCount: number, dtMs: number): void {
    feed.drain((note) => {
      // A creature the team does not have at the master level shows a caption only in dev (the debug hook).
      if (import.meta.env.DEV) this.ensure(note.creature);
      const view = this.views.get(note.creature);
      if (!view) return;
      if (this.current && this.current !== view) this.current.end();
      this.current = view;
      view.note();
    });
    const view = this.current;
    if (!view) return;
    captionSpot(view.width, badgeCount, LOGICAL_SIZE.width, this.spot);
    view.update(dtMs, this.spot, this.look);
    if (!view.active) this.current = null;
  }

  /** Drops the showing caption at once (after a failure: nothing of it stays on screen). */
  hide(): void {
    const view = this.current;
    this.current = null;
    view?.end();
  }

  clear(): void {
    for (const view of this.views.values()) view.destroy();
    this.views = new Map();
    this.current = null;
  }
}
