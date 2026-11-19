import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { IDLE_MOTION, IDLE_PHASE } from '../../../data/common/idle-motion';
import { PALETTE } from '../../../data/common/palette';
import { formatNumber, t } from '../../../i18n';
import { lerp, stepToward } from '../../../util/math';
import { flightClearBand } from '../../camera-layout';
import { effectsMode } from '../../effects-mode';
import { TEMPO_ICON_KEY } from '../creatures/creature-icons';
import { idlePose, REST_POSE, type IdlePose } from '../common/idle-motion';
import { createStrokedText } from '../common/outlined-text';
import { HudPlate } from '../style/hud-plate';
import { hudPlateRects, tempoCaptionLook, tempoCaptionSpot } from './tempo-caption';
import { tempoChipX } from './tempo-chip-layout';
import type { PlateEdge } from './wobble-bar';

const { tempoChip: cfg } = HUD_LAYOUT;
const { fadeMs, minScale } = ANIM.tempoChip;

/**
 * The tempo ease sign: a small see-through plate docked to the right end of the wobble plate, with
 * the snail and the layers left. It fades and grows in while the ease lasts and out after it,
 * and sways with the wobble plate; with reduced effects it appears at once and stands still. When it
 * appears a short «Breather» caption shows above it (`tempo-caption.ts`); it is built with the scene.
 */
export class TempoChip {
  private readonly plate: HudPlate;
  private readonly root: Phaser.GameObjects.Container;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };
  /** 0 hidden, 1 fully shown. */
  private shown = 0;
  private count = -1;
  private readonly caption: Phaser.GameObjects.Text;
  /** Where the caption stands (screen px); `null` when there is no room for it. */
  private captionSpot: { x: number; y: number } | null = null;
  /** Age of the caption in ms; -1 while it is not showing. */
  private captionAge = -1;
  private wasOn = false;

  constructor(scene: Phaser.Scene) {
    this.plate = new HudPlate(scene);
    const icon = scene.add
      .image(-cfg.width / 2 + cfg.iconInset + cfg.iconSize / 2, 0, TEMPO_ICON_KEY)
      .setDisplaySize(cfg.iconSize, cfg.iconSize);
    this.counter = createStrokedText(
      scene,
      cfg.width / 2 - cfg.iconInset - cfg.font / 4,
      0,
      '',
      cfg.font,
      PALETTE.textLight,
      PALETTE.textDark,
      cfg.stroke,
    );
    this.caption = createStrokedText(
      scene,
      0,
      0,
      t('run.breather'),
      cfg.captionFont,
      PALETTE.textLight,
      PALETTE.textDark,
      cfg.captionStroke,
    ).setVisible(false);
    this.root = scene.add.container(0, 0, [this.plate, icon, this.counter]).setVisible(false);
  }

  /** Docks the chip to the wobble plate; call after the plate is laid out. */
  layout(edge: Readonly<PlateEdge>, screenWidth: number, screenHeight: number): void {
    this.plate.place(0, 0, cfg.width, edge.height);
    const x = tempoChipX(edge.right, cfg.width, cfg.gap);
    this.root.setPosition(x, edge.y);
    const band = flightClearBand(screenHeight);
    const spot = tempoCaptionSpot({
      textWidth: this.caption.width,
      textHeight: this.caption.height,
      screenWidth,
      chipRight: x + cfg.width / 2,
      chipTop: edge.y - edge.height / 2,
      obstacles: [
        ...hudPlateRects(),
        { left: 0, top: band.top, right: screenWidth, bottom: band.bottom },
      ],
    });
    this.captionSpot = spot && { x: (spot.left + spot.right) / 2, y: (spot.top + spot.bottom) / 2 };
  }

  update(layersLeft: number, timeMs: number, deltaMs: number): void {
    const target = layersLeft > 0 ? 1 : 0;
    if (target === 1 && !this.wasOn && this.captionSpot) this.captionAge = 0;
    this.wasOn = target === 1;
    this.updateCaption(deltaMs);
    this.shown = effectsMode.reduced ? target : stepToward(this.shown, target, deltaMs / fadeMs);
    this.root.setVisible(this.shown > 0);
    if (this.shown <= 0) return;
    if (layersLeft > 0 && layersLeft !== this.count) {
      this.count = layersLeft;
      this.counter.setText(formatNumber(layersLeft));
    }
    const grow = lerp(minScale, 1, this.shown);
    const pose = effectsMode.reduced
      ? REST_POSE
      : idlePose(IDLE_MOTION.wobblePlate, timeMs, IDLE_PHASE.tempoChip, this.pose);
    this.root.setAlpha(this.shown).setScale(grow * pose.scaleX, grow * pose.scaleY);
    this.root.setAngle(pose.angle);
  }

  private updateCaption(deltaMs: number): void {
    const spot = this.captionSpot;
    const look =
      spot && this.captionAge >= 0 ? tempoCaptionLook(this.captionAge, effectsMode.level) : null;
    this.caption.setVisible(look !== null);
    if (!spot || !look) {
      this.captionAge = -1;
      return;
    }
    this.caption.setPosition(spot.x, spot.y - look.lift).setAlpha(look.alpha);
    this.captionAge += deltaMs;
  }
}
