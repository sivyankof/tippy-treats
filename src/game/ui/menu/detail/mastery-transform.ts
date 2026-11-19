import * as Phaser from 'phaser';
import { hasNewLook, masterInfo } from '../../../../core/creatures/mastery';
import type { CreatureId } from '../../../../data/creatures/creatures';
import { ANIM } from '../../../../data/common/anim';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { TRANSFORM } from '../../../../data/creatures/transform-scene';
import { formatDecimal, t } from '../../../../i18n';
import { services } from '../../../../services';
import { effectsMode } from '../../../effects-mode';
import { FX_TEXTURES } from '../../../fx/common/fx-textures';
import type { Particles } from '../../../fx/common/particles';
import { starBurst } from '../../../fx/common/sparkle-fx';
import { CreaturePortrait, squeakPitch } from '../../../objects/creatures/creature-portrait';
import { createDimOverlay } from '../../common/dim-overlay';
import { HudPlate } from '../../style/hud-plate';
import { TitleRibbon } from '../../style/title-ribbon';
import { createBodyText } from './detail-info';
import { formatValues } from './detail-model';
import { LightRays } from '../new-creature/new-creature-rays';
import { transformCues, transformFrame, type TransformKind } from './transform-plan';

const cfg = TRANSFORM;
const ring = ANIM.perfect.ring;
/** The scene sits over every other part of the window. */
const DEPTH = MENU.detail.bio.depth * 2;

export interface TransformOptions {
  id: CreatureId;
  kind: TransformKind;
  /** Level before the upgrade, which sets the old picture. */
  fromLevel: number;
  /** Level after it, which sets the new one. */
  toLevel: number;
  /** Where the creature of the window stands: the scene replaces it on the spot. */
  at: { x: number; y: number };
  particles: Particles;
  /** The scene is gone (it ended or was skipped). */
  onDone: () => void;
}

/**
 * The short scene after an upgrade to the new look or to the master level (docs/06, "Превращение"):
 * the creature shakes, a puff covers it, it jumps out in its new picture with sparkles; at level 5
 * a gold flash follows (rays, a ring) and the master name stands under it. A tap skips it. The
 * whole timeline is the pure `transformFrame`; this class only turns a frame into pictures.
 */
export class MasteryTransform {
  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly rays: LightRays | null;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly puff: Phaser.GameObjects.Container;
  private readonly before: CreaturePortrait;
  private readonly after: CreaturePortrait;
  private readonly labels: Phaser.GameObjects.Container[] = [];
  private readonly minimal = effectsMode.reduced;
  private readonly cues = transformCues(this.minimal);
  private ms = 0;
  private burstDone = false;
  private flashDone = false;
  private finished = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: TransformOptions,
  ) {
    const { width, height } = scene.scale.gameSize;
    const { x, y } = o.at;
    this.veil = createDimOverlay(scene, 1, width, height).setDepth(DEPTH).setInteractive();
    this.veil.on(Phaser.Input.Events.POINTER_DOWN, () => this.skip());
    this.rays =
      o.kind === 'master' && !this.minimal
        ? new LightRays(scene, cfg.gold, { count: cfg.raysCount, radius: cfg.raysRadius })
            .setPosition(x, y)
            .setDepth(DEPTH + 1)
        : null;
    this.ring = scene.add
      .image(x, y, FX_TEXTURES.rim)
      .setDepth(DEPTH + 2)
      .setVisible(false);
    this.before = this.portrait(x, y, o.fromLevel);
    this.after = this.portrait(x, y, o.toLevel);
    this.puff = this.createPuff(x, y);
    this.labels.push(this.createLabels(x, y, width - cfg.sideMargin * 2));
    this.apply();
  }

  /** Moves the scene on by `dtMs`; call it every frame while `active`. */
  update(dtMs: number): void {
    if (this.finished) return;
    this.rays?.tick(dtMs);
    this.before.tick(dtMs);
    this.after.tick(dtMs);
    this.seek(this.ms + dtMs);
  }

  get active(): boolean {
    return !this.finished;
  }

  /** Jumps to `ms` on the timeline (a skip jumps to the end). */
  seek(ms: number): void {
    this.ms = Math.min(ms, this.cues.totalMs);
    if (!this.burstDone && this.ms >= this.cues.burstMs) {
      this.burstDone = true;
      this.burst(PALETTE.textLight);
      services.audio.squeak(squeakPitch(this.o.id));
      services.haptics.play('success');
    }
    if (this.o.kind === 'master' && !this.flashDone && this.ms >= this.cues.flashMs) {
      this.flashDone = true;
      this.burst(cfg.gold);
      services.audio.rainbowChime();
    }
    this.apply();
    if (this.ms >= this.cues.totalMs) this.finish();
  }

  skip(): void {
    if (this.finished) return;
    this.seek(this.cues.totalMs);
  }

  private portrait(x: number, y: number, level: number): CreaturePortrait {
    return new CreaturePortrait(
      this.scene,
      x,
      y,
      this.o.id,
      level,
      MENU.detail.portraitWidth,
      1,
      hasNewLook(level),
    ).setDepth(DEPTH + 3);
  }

  /** The ribbon (the new look or the master name) and, for the master, its one phrase under it. */
  private createLabels(x: number, y: number, maxWidth: number): Phaser.GameObjects.Container {
    const info = masterInfo(this.o.id);
    const master = this.o.kind === 'master';
    // The ribbon carries just the name: "Master: «Name»" would not fit a ribbon in Russian.
    const title = master ? t(info.nameKey) : t('detail.transformLook');
    const ribbon = new TitleRibbon(this.scene, 0, 0, title);
    ribbon.setMaxWidth(maxWidth);
    const group = this.scene.add.container(x, y + cfg.labelGap, [ribbon]).setDepth(DEPTH + 5);
    if (master) {
      const phrase = t(info.shortKey, formatValues(info.values, formatDecimal));
      const text = createBodyText(this.scene, phrase, cfg.phraseFont)
        .setOrigin(0.5, 0)
        .setY(cfg.lineGap);
      // A plate keeps the ribbon and the phrase readable over the window text before the veil lands.
      const { padX, padY, alpha } = cfg.plate;
      const top = -MENU.style.ribbon.height / 2 - padY;
      const bottom = cfg.lineGap + text.height + padY;
      const plate = new HudPlate(this.scene, PALETTE.panel, alpha).place(
        0,
        (top + bottom) / 2,
        Math.max(ribbon.fullWidth, text.width) + padX * 2,
        bottom - top,
      );
      group.addAt(plate, 0);
      group.add(text);
    }
    return group;
  }

  /** Burst of stars out of the creature; the minimal level has none. */
  private burst(tint: number): void {
    if (this.minimal) return;
    starBurst(
      this.o.particles,
      this.before.x,
      this.before.y,
      cfg.burst.count,
      0,
      MENU.detail.burst.style,
      [tint, cfg.goldPale],
    );
  }

  /** Flat round lobes (white, warm outline) around the creature that make the cloud. */
  private createPuff(x: number, y: number): Phaser.GameObjects.Container {
    const { discs, radius, spread, outlineWidth } = cfg.puff;
    const size = (radius + outlineWidth) * 2;
    const parts: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < discs; i++) {
      const angle = (i / discs) * Math.PI * 2;
      const at = i === 0 ? 0 : spread;
      parts.push(
        this.scene.add
          .image(Math.cos(angle) * at, Math.sin(angle) * at * cfg.puff.squash, FX_TEXTURES.puffLobe)
          .setDisplaySize(size, size),
      );
    }
    return this.scene.add
      .container(x, y, parts)
      .setDepth(DEPTH + 4)
      .setVisible(false);
  }

  private apply(): void {
    const f = transformFrame(this.ms, this.o.kind, this.minimal);
    this.veil.setAlpha(cfg.veilAlpha * f.fade);
    for (const portrait of [this.before, this.after]) portrait.setAngle(f.angle).setScale(f.scale);
    // Full and lite swap under the cloud; minimal flows one picture into the other.
    const shown = !f.hidden && f.fade > 0;
    this.before.setVisible(shown && (this.minimal || f.mix < 1)).setAlpha(f.fade);
    this.after.setVisible(shown && f.mix > 0).setAlpha((this.minimal ? f.mix : 1) * f.fade);
    // The cloud grows and shrinks instead of fading: see-through lobes would show each other's outlines.
    this.puff
      .setVisible(f.puff.alpha > 0 && f.fade > 0)
      .setAlpha(f.fade)
      .setScale(f.puff.scale * (cfg.puffFadeScale + (1 - cfg.puffFadeScale) * f.puff.alpha));
    this.rays?.setAlpha(f.rays * f.fade);
    const showRing = f.ring >= 0 && f.ring < 1;
    this.ring.setVisible(showRing);
    if (showRing) {
      const size =
        MENU.detail.portraitWidth * cfg.ringScale * (cfg.ringFrom + (1 - cfg.ringFrom) * f.ring);
      const sx = (size * ring.widthRatio) / cfg.rim.size;
      const sy = (size * ring.heightRatio) / cfg.rim.size;
      this.ring.setScale(sx, sy).setAlpha((1 - f.ring) * f.fade);
    }
    for (const label of this.labels) label.setAlpha(f.labels * f.fade);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.scene.tweens.killTweensOf(this.labels.flatMap((label) => label.list));
    for (const part of [
      this.veil,
      this.rays,
      this.ring,
      this.puff,
      this.before,
      this.after,
      ...this.labels,
    ]) {
      part?.destroy();
    }
    this.o.onDone();
  }
}
