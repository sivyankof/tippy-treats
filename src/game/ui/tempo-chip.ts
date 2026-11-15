import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { IDLE_MOTION, IDLE_PHASE } from '../../data/idle-motion';
import { PALETTE } from '../../data/palette';
import { formatNumber } from '../../i18n';
import { lerp, stepToward } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { TEMPO_ICON_KEY } from './creature-icons';
import { idlePose, REST_POSE, type IdlePose } from './idle-motion';
import { createStrokedText } from './outlined-text';
import { HudPlate } from './style/hud-plate';
import { tempoChipX } from './tempo-chip-layout';
import type { PlateEdge } from './wobble-bar';

const { tempoChip: cfg } = HUD_LAYOUT;
const { fadeMs, minScale } = ANIM.tempoChip;

/**
 * The tempo ease sign: a small see-through plate docked to the right end of the wobble plate, with
 * the snail and the layers left. It fades and grows in while the ease lasts and out after it,
 * and sways with the wobble plate; with reduced effects it appears at once and stands still.
 */
export class TempoChip {
  private readonly plate: HudPlate;
  private readonly root: Phaser.GameObjects.Container;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };
  /** 0 hidden, 1 fully shown. */
  private shown = 0;
  private count = -1;

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
    this.root = scene.add.container(0, 0, [this.plate, icon, this.counter]).setVisible(false);
  }

  /** Docks the chip to the wobble plate; call after the plate is laid out. */
  layout(edge: Readonly<PlateEdge>): void {
    this.plate.place(0, 0, cfg.width, edge.height);
    this.root.setPosition(tempoChipX(edge.right, cfg.width, cfg.gap), edge.y);
  }

  update(layersLeft: number, timeMs: number, deltaMs: number): void {
    const target = layersLeft > 0 ? 1 : 0;
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
}
