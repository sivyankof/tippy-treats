import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { cssColor } from '../../util/color';
import { oscillate01 } from '../../util/math';
import { stepSpring, type SpringState } from '../fx/anim-curves';
import { bakeTexture } from './bake-texture';
import type { Movable } from './transition';
import { FONT_FAMILY, FONT_WEIGHT } from './fonts';

const TRACK_ALPHA = 0.35;
const TEXTURES = {
  track: 'ui_bar_track',
  ok: 'ui_bar_ok',
  danger: 'ui_bar_danger',
  wave: 'ui_bar_wave',
} as const;
const { barWidth, barHeight, barPad, labelGap, labelFont, barY } = HUD_LAYOUT;
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

/** Wobble label and gauge: baked pill textures, nothing is re-tessellated per frame. */
export class WobbleBar {
  private readonly label: Phaser.GameObjects.Text;
  /** Track, fills and wave band: scaled together for the danger pulse. */
  private readonly gauge: Phaser.GameObjects.Container;
  private readonly fillOk: Phaser.GameObjects.NineSlice;
  private readonly fillDanger: Phaser.GameObjects.NineSlice;
  private readonly wave: Phaser.GameObjects.Image;
  /** Fill width in pixels as a spring: it overshoots on a jump and settles. */
  private readonly spring: SpringState = { value: 0, velocity: 0 };
  private fillWidth = -1;
  private danger: boolean | null = null;

  constructor(scene: Phaser.Scene) {
    bakePill(
      scene,
      TEXTURES.track,
      barWidth,
      barHeight,
      TRACK_RADIUS,
      PALETTE.textDark,
      TRACK_ALPHA,
    );
    const minFill = FILL_HEIGHT;
    bakePill(scene, TEXTURES.ok, minFill * 2, FILL_HEIGHT, FILL_RADIUS, PALETTE.success, 1);
    bakePill(scene, TEXTURES.danger, minFill * 2, FILL_HEIGHT, FILL_RADIUS, PALETTE.danger, 1);
    bakePill(
      scene,
      TEXTURES.wave,
      ANIM.wobbleBar.waveWidth,
      FILL_HEIGHT,
      FILL_RADIUS,
      PALETTE.textLight,
      1,
    );

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

  /** Label and gauge, for screen transitions. */
  get parts(): Movable[] {
    return [this.label, this.gauge];
  }

  /** Centres label and gauge as one row. Call on creation and on every resize. */
  layout(screenWidth: number): void {
    const left = (screenWidth - barWidth) / 2 + (this.label.width + labelGap) / 2;
    this.gauge.setX(left + barWidth / 2);
    this.label.setX(left - labelGap);
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
      this.label.setColor(cssColor(danger ? PALETTE.danger : PALETTE.textDark));
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
    this.gauge.setScale(danger ? 1 + (ANIM.wobbleBar.pulseScale - 1) * pulse : 1);
  }
}
