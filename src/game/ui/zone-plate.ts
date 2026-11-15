import * as Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { ZONE_BANNER } from '../../data/zone-plate';
import { ZONES } from '../../data/zones';
import { t } from '../../i18n';
import { DEG_TO_RAD, sineWave } from '../../util/math';
import { fitText } from './menu/fit-text';
import { createOutlinedText } from './outlined-text';
import { createVolumeImage, faceOffsetY, lookOf } from './style/volume';

const { width, height } = ZONE_BANNER;

/**
 * The plate with the name of a new zone: a card plate of the kit with an accent rim. It is shown
 * over the HUD scene, does not take taps, and drops in from above, hangs, then leaves upwards.
 */
export class ZoneBanner {
  private readonly root: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private hangTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    // One baked image, not a nine-slice: the plate is tilted, and a tilted nine-slice breaks up.
    const plate = createVolumeImage(scene, 'ui_zone_banner', width, height, lookOf('card'), {
      rim: PALETTE.accent,
    });
    this.label = createOutlinedText(scene, 0, faceOffsetY('card'), '', ZONE_BANNER.fontSize);
    this.root = scene.add
      .container(0, -height, [plate, this.label])
      .setVisible(false)
      .setRotation(ZONE_BANNER.tiltDeg * DEG_TO_RAD);
  }

  /** Centres the plate on a screen `screenWidth` wide. */
  layout(screenWidth: number): void {
    this.root.setX(screenWidth / 2);
  }

  /** Announces the zone with this index. */
  show(zoneIndex: number): void {
    const zone = ZONES[zoneIndex];
    if (!zone) return;
    fitText(this.label.setText(t(`zone.${zone.id}.name`)), width - ZONE_BANNER.labelPad * 2);
    this.hangTimer?.remove();
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(true).setY(-height);
    this.scene.tweens.add({
      targets: this.root,
      y: ZONE_BANNER.restY,
      duration: ZONE_BANNER.inMs,
      ease: ZONE_BANNER.inEase,
      onComplete: () => {
        this.hangTimer = this.scene.time.delayedCall(ZONE_BANNER.holdMs, () => this.leave());
      },
    });
  }

  /** Sways a little while the plate hangs. */
  update(timeMs: number): void {
    if (!this.root.visible) return;
    const sway = ZONE_BANNER.swayDeg * sineWave(timeMs, ZONE_BANNER.swayMs);
    this.root.setRotation((ZONE_BANNER.tiltDeg + sway) * DEG_TO_RAD);
  }

  private leave(): void {
    this.scene.tweens.add({
      targets: this.root,
      y: -height,
      duration: ZONE_BANNER.outMs,
      ease: ZONE_BANNER.outEase,
      onComplete: () => this.root.setVisible(false),
    });
  }
}
