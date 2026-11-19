import * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { ZONE_BANNER, type PlateSpec } from '../../../data/zones/zone-plate';
import { ZONES } from '../../../data/zones/zones';
import { t } from '../../../i18n';
import { playFx } from '../../fx-sound';
import { DEG_TO_RAD, sineWave } from '../../../util/math';
import { fitText } from '../menu/fit-text';
import { createOutlinedText } from '../common/outlined-text';
import { createVolumeImage, faceOffsetY, lookOf } from '../style/volume';

/**
 * A plate with a short text over the HUD scene: a card plate of the kit with an accent rim. It does
 * not take taps, and drops in from above, hangs, then leaves upwards. The zone plate shows the name
 * of a new zone; the lap plate ("Lap N") is the same class with a smaller spec.
 */
export class ZoneBanner {
  private readonly width: number;
  private readonly height: number;
  private readonly root: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private hangTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spec: PlateSpec = ZONE_BANNER,
    textureKey = 'ui_zone_banner',
  ) {
    const { width, height } = spec;
    this.width = width;
    this.height = height;
    // One baked image, not a nine-slice: the plate is tilted, and a tilted nine-slice breaks up.
    const plate = createVolumeImage(scene, textureKey, width, height, lookOf('card'), {
      rim: PALETTE.accent,
    });
    this.label = createOutlinedText(scene, 0, faceOffsetY('card'), '', spec.fontSize);
    this.root = scene.add
      .container(0, -height, [plate, this.label])
      .setVisible(false)
      .setRotation(spec.tiltDeg * DEG_TO_RAD);
  }

  /** Centres the plate on a screen `screenWidth` wide (or hangs it from the left edge when its spec says so). */
  layout(screenWidth: number): void {
    const left = this.spec.leftMargin;
    this.root.setX(left === undefined ? screenWidth / 2 : left + this.width / 2);
  }

  /** Announces the zone with this index. */
  show(zoneIndex: number): void {
    const zone = ZONES[zoneIndex];
    if (!zone) return;
    playFx('zoneChange');
    this.showText(t(`zone.${zone.id}.name`));
  }

  /** Announces lap `lap` of Space. */
  showLap(lap: number): void {
    playFx('lapChange');
    this.showText(t('zone.lap', { n: lap }));
  }

  /**
   * Writes the name of a zone that is coming soon while the plate is hidden, so the frame of the
   * change does not draw the text (a new text is drawn and sent to the video chip at once).
   */
  prepare(zoneIndex: number): void {
    const zone = ZONES[zoneIndex];
    if (zone) this.prepareText(t(`zone.${zone.id}.name`));
  }

  /** The same for lap `lap` of Space. */
  prepareLap(lap: number): void {
    this.prepareText(t('zone.lap', { n: lap }));
  }

  private prepareText(text: string): void {
    if (!this.root.visible && this.label.text !== text) this.setLabel(text);
  }

  private setLabel(text: string): void {
    fitText(this.label.setText(text), this.width - this.spec.labelPad * 2);
  }

  private showText(text: string): void {
    const { height } = this;
    const spec = this.spec;
    if (this.label.text !== text) this.setLabel(text);
    this.hangTimer?.remove();
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(true).setY(-height);
    this.scene.tweens.add({
      targets: this.root,
      y: spec.restY,
      duration: spec.inMs,
      ease: spec.inEase,
      onComplete: () => {
        this.hangTimer = this.scene.time.delayedCall(spec.holdMs, () => this.leave());
      },
    });
  }

  /** Sways a little while the plate hangs. */
  update(timeMs: number): void {
    if (!this.root.visible) return;
    const sway = this.spec.swayDeg * sineWave(timeMs, this.spec.swayMs);
    this.root.setRotation((this.spec.tiltDeg + sway) * DEG_TO_RAD);
  }

  private leave(): void {
    this.scene.tweens.add({
      targets: this.root,
      y: -this.height,
      duration: this.spec.outMs,
      ease: this.spec.outEase,
      onComplete: () => this.root.setVisible(false),
    });
  }
}
