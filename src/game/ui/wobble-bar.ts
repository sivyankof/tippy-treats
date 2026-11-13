import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { PALETTE } from '../../data/palette';
import { t } from '../../i18n';
import { cssColor } from '../../util/color';
import { bakeTexture } from './bake-texture';
import { FONT_FAMILY, FONT_WEIGHT } from './fonts';

const TRACK_ALPHA = 0.35;
const TEXTURES = { track: 'ui_bar_track', ok: 'ui_bar_ok', danger: 'ui_bar_danger' } as const;
const { barWidth, barHeight, barPad, labelGap, labelFont, barY } = HUD_LAYOUT;
const FILL_HEIGHT = barHeight - barPad * 2;
const FILL_RADIUS = FILL_HEIGHT / 2;
const TRACK_RADIUS = barHeight / 2;

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
  private readonly track: Phaser.GameObjects.Image;
  private readonly fillOk: Phaser.GameObjects.NineSlice;
  private readonly fillDanger: Phaser.GameObjects.NineSlice;
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

    this.label = scene.add
      .text(0, barY, t('run.wobble'), {
        fontFamily: FONT_FAMILY,
        fontStyle: FONT_WEIGHT.extraBold,
        fontSize: labelFont,
        color: cssColor(PALETTE.textDark),
      })
      .setOrigin(1, 0.5);
    this.track = scene.add.image(0, barY, TEXTURES.track).setOrigin(0, 0.5);
    const fill = (key: string): Phaser.GameObjects.NineSlice =>
      scene.add
        .nineslice(
          0,
          barY,
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
  }

  /** Centres label and gauge as one row. Call on creation and on every resize. */
  layout(screenWidth: number): void {
    const left = (screenWidth - barWidth) / 2 + (this.label.width + labelGap) / 2;
    this.track.setX(left);
    this.fillOk.setX(left + barPad);
    this.fillDanger.setX(left + barPad);
    this.label.setX(left - labelGap);
  }

  update(wobble: number): void {
    const ratio = Phaser.Math.Clamp(wobble / BALANCE.wobble.max, 0, 1);
    const danger = wobble > ANIM.hud.wobbleDangerAt;
    if (danger !== this.danger) {
      this.danger = danger;
      this.label.setColor(cssColor(danger ? PALETTE.danger : PALETTE.textDark));
    }
    const width = Math.round((barWidth - barPad * 2) * ratio);
    const shown = width > 0;
    this.fillOk.setVisible(shown && !danger);
    this.fillDanger.setVisible(shown && danger);
    if (shown && width !== this.fillWidth) {
      this.fillWidth = width;
      const size = Math.max(width, FILL_HEIGHT);
      this.fillOk.setSize(size, FILL_HEIGHT);
      this.fillDanger.setSize(size, FILL_HEIGHT);
    }
  }
}
