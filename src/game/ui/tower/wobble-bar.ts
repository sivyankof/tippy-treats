import * as Phaser from 'phaser';
import { ANIM } from '../../../data/common/anim';
import { BALANCE } from '../../../data/tower/balance';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { MENU } from '../../../data/common/menu-layout';
import { IDLE_MOTION, IDLE_PHASE } from '../../../data/common/idle-motion';
import { PALETTE } from '../../../data/common/palette';
import { t } from '../../../i18n';
import { cssColor } from '../../../util/color';
import { oscillate01 } from '../../../util/math';
import { stepSpring, type SpringState } from '../../fx/common/anim-curves';
import { bakeTexture } from '../common/bake-texture';
import { applyIdlePose, idlePose, type IdlePose } from '../common/idle-motion';
import { HudPlate, hudPlateWidth } from '../style/hud-plate';
import { drawBarFill, drawBarTrack } from '../style/volume-bar';
import { wobbleCentreX } from './tempo-chip-layout';
import type { Movable } from '../common/transition';
import { FONT_FAMILY, FONT_WEIGHT } from '../common/fonts';

/** The right end of the wobble plate, its centre line and its height. */
export interface PlateEdge {
  right: number;
  y: number;
  height: number;
}

const TEXTURES = {
  track: 'ui_bar_track',
  ok: 'ui_bar_ok',
  danger: 'ui_bar_danger',
  wave: 'ui_bar_wave',
} as const;
const {
  barWidth,
  barHeight,
  barPad,
  labelGap,
  labelFont,
  barY,
  barPlate,
  trackBorder,
  barDangerText,
  tempoChip,
} = HUD_LAYOUT;
const FILL_HEIGHT = barHeight - barPad * 2;
const FILL_RADIUS = FILL_HEIGHT / 2;
const TRACK_RADIUS = barHeight / 2;
const FILL_MAX_WIDTH = barWidth - barPad * 2;

function bakePill(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  radius: number,
  color: number,
  alpha: number,
): void {
  bakeTexture(scene, key, width, height, (g) => {
    g.fillStyle(color, alpha).fillRoundedRect(0, 0, width, height, radius);
  });
}

/**
 * Wobble label and gauge on a see-through plate of the kit: baked textures, nothing is re-tessellated per
 * frame. All three sway a little (`IDLE_MOTION`), so the bar never stands still.
 */
export class WobbleBar {
  private readonly plate: HudPlate;
  private readonly label: Phaser.GameObjects.Text;
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };
  /** Track, fills and wave band: scaled together for the danger pulse. */
  private readonly gauge: Phaser.GameObjects.Container;
  private readonly fillOk: Phaser.GameObjects.NineSlice;
  private readonly fillDanger: Phaser.GameObjects.NineSlice;
  private readonly wave: Phaser.GameObjects.Image;
  /** Fill width in pixels as a spring: it overshoots on a jump and settles. */
  private readonly spring: SpringState = { value: 0, velocity: 0 };
  private fillWidth = -1;
  /** Right end and height of the plate at rest, for what docks to it. */
  private edge: PlateEdge = { right: 0, y: barY, height: 0 };
  private danger: boolean | null = null;

  constructor(scene: Phaser.Scene) {
    // Track and fills are baked once with the volume of the kit's bars (`style/volume-bar.ts`);
    // in the frame only the fill is stretched.
    bakeTexture(scene, TEXTURES.track, barWidth, barHeight, (g) => {
      // Like the baker level bar: a dark warm frame round a grooved empty part.
      g.fillStyle(PALETTE.textDark, 1).fillRoundedRect(0, 0, barWidth, barHeight, TRACK_RADIUS);
      const inner = {
        left: trackBorder,
        top: trackBorder,
        width: barWidth - trackBorder * 2,
        height: barHeight - trackBorder * 2,
        radius: TRACK_RADIUS - trackBorder,
      };
      drawBarTrack(g, inner, { back: MENU.xpBar.back });
    });
    const minFill = FILL_HEIGHT;
    const bakeFill = (key: string, color: number): void =>
      bakeTexture(scene, key, minFill * 2, FILL_HEIGHT, (g) =>
        drawBarFill(
          g,
          { left: 0, top: 0, width: minFill * 2, height: FILL_HEIGHT, radius: FILL_RADIUS },
          color,
        ),
      );
    bakeFill(TEXTURES.ok, PALETTE.success);
    bakeFill(TEXTURES.danger, PALETTE.danger);
    bakePill(
      scene,
      TEXTURES.wave,
      ANIM.wobbleBar.waveWidth,
      FILL_HEIGHT,
      FILL_RADIUS,
      PALETTE.textLight,
      1,
    );

    // Created first: it draws under the label and the gauge.
    this.plate = new HudPlate(scene);
    this.label = scene.add
      .text(0, barY, t('run.wobble'), {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT.extraBold,
        fontSize: labelFont,
        color: cssColor(PALETTE.textDark),
      })
      .setOrigin(1, 0.5);
    // The container sits on the centre of the track so that scaling pulses around it.
    const track = scene.add.image(-barWidth / 2, 0, TEXTURES.track).setOrigin(0, 0.5);
    const fill = (key: string): Phaser.GameObjects.NineSlice =>
      scene.add
        .nineslice(
          barPad - barWidth / 2,
          0,
          key,
          undefined,
          FILL_HEIGHT,
          FILL_HEIGHT,
          FILL_RADIUS,
          FILL_RADIUS,
          0,
          0,
        )
        .setOrigin(0, 0.5);
    this.fillOk = fill(TEXTURES.ok);
    this.fillDanger = fill(TEXTURES.danger);
    this.wave = scene.add
      .image(0, 0, TEXTURES.wave)
      .setOrigin(0, 0.5)
      .setAlpha(ANIM.wobbleBar.waveAlpha)
      .setVisible(false);
    this.gauge = scene.add.container(0, barY, [track, this.fillOk, this.fillDanger, this.wave]);
  }

  /** Plate, label and gauge, for screen transitions. */
  get parts(): Movable[] {
    return [this.plate, this.label, this.gauge];
  }

  /** Centres label and gauge as one row on the plate. Call on creation and on every resize. */
  layout(screenWidth: number): void {
    const rowWidth = this.label.width + labelGap + barWidth;
    const rowHeight = Math.max(this.label.height, barHeight);
    const plateWidth = hudPlateWidth(rowWidth + barPlate.padX * 2);
    const plateHeight = rowHeight + barPlate.padY * 2;
    // The row leaves room for the tempo chip on its right, so the chip never covers the plate.
    const centre = wobbleCentreX(
      screenWidth,
      plateWidth,
      tempoChip.width,
      tempoChip.gap,
      tempoChip.margin,
    );
    const left = centre - barWidth / 2 + (this.label.width + labelGap) / 2;
    this.gauge.setX(left + barWidth / 2);
    this.label.setX(left - labelGap);
    this.plate.place(centre, barY, plateWidth, plateHeight);
    this.edge = { right: centre + plateWidth / 2, y: barY, height: plateHeight };
  }

  /** Where the plate ends, for the tempo chip that docks to it. */
  get plateEdge(): Readonly<PlateEdge> {
    return this.edge;
  }

  /** `timeMs` drives the running band and the pulse, `deltaMs` the spring. */
  update(wobble: number, timeMs: number, deltaMs: number): void {
    const target = FILL_MAX_WIDTH * Phaser.Math.Clamp(wobble / BALANCE.wobble.max, 0, 1);
    stepSpring(
      this.spring,
      target,
      ANIM.wobbleBar.fillStiffness,
      ANIM.wobbleBar.fillDamping,
      deltaMs,
    );

    const danger = wobble > ANIM.wobble.dangerFrom;
    if (danger !== this.danger) {
      this.danger = danger;
      this.label.setColor(cssColor(danger ? barDangerText : PALETTE.textDark));
    }
    const width = Math.round(Phaser.Math.Clamp(this.spring.value, 0, FILL_MAX_WIDTH));
    const shown = width > 0;
    this.fillOk.setVisible(shown && !danger);
    this.fillDanger.setVisible(shown && danger);
    if (shown && width !== this.fillWidth) {
      this.fillWidth = width;
      const size = Math.max(width, FILL_HEIGHT);
      this.fillOk.setSize(size, FILL_HEIGHT);
      this.fillDanger.setSize(size, FILL_HEIGHT);
    }
    this.updateWave(timeMs, width);
    this.updatePulse(timeMs, danger);
    this.updateIdle(timeMs);
  }

  /** The label and the plate breathe a little; the gauge's own breath is folded into its pulse. */
  private updateIdle(timeMs: number): void {
    applyIdlePose(
      this.label,
      idlePose(IDLE_MOTION.wobbleLabel, timeMs, IDLE_PHASE.label, this.pose),
    );
    applyIdlePose(
      this.plate,
      idlePose(IDLE_MOTION.wobblePlate, timeMs, IDLE_PHASE.plate, this.pose),
    );
  }

  /** The lighter band eases back and forth along the fill and never leaves it. */
  private updateWave(timeMs: number, fillWidth: number): void {
    const bandWidth = Math.min(ANIM.wobbleBar.waveWidth, fillWidth);
    const visible = fillWidth >= FILL_HEIGHT;
    this.wave.setVisible(visible);
    if (!visible) return;
    // Starts at the left end of the fill (a quarter turn behind the sine).
    const phase = oscillate01(timeMs, ANIM.wobbleBar.wavePeriodMs, -Math.PI / 2);
    this.wave
      .setDisplaySize(bandWidth, FILL_HEIGHT)
      .setX(barPad - barWidth / 2 + (fillWidth - bandWidth) * phase);
  }

  private updatePulse(timeMs: number, danger: boolean): void {
    const pulse = oscillate01(timeMs, ANIM.wobbleBar.pulsePeriodMs);
    const grow = danger ? 1 + (ANIM.wobbleBar.pulseScale - 1) * pulse : 1;
    const idle = idlePose(IDLE_MOTION.wobbleGauge, timeMs, IDLE_PHASE.gauge, this.pose);
    this.gauge.setScale(grow * idle.scaleX, grow * idle.scaleY);
  }
}
