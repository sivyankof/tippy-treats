import * as Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { ZONE_BANNER } from '../../data/zone-plate';
import { ZONES } from '../../data/zones';
import { t } from '../../i18n';
import { DEG_TO_RAD, sineWave } from '../../util/math';
import { bakeTexture } from './bake-texture';
import { createStrokedText } from './outlined-text';

const TEXTURE = 'ui_zone_banner';
const { width, height, radius, shadowOffset, edge, edgeInset } = ZONE_BANNER;

function bakePlate(scene: Phaser.Scene): void {
  bakeTexture(scene, TEXTURE, width, height + shadowOffset, (g) => {
    g.fillStyle(PALETTE.panelShadow, 1);
    g.fillRoundedRect(0, shadowOffset, width, height, radius);
    g.fillStyle(PALETTE.panel, 1);
    g.fillRoundedRect(0, 0, width, height, radius);
    g.lineStyle(edge, PALETTE.accent, 1);
    g.strokeRoundedRect(
      edgeInset,
      edgeInset,
      width - edgeInset * 2,
      height - edgeInset * 2,
      radius - edgeInset / 2,
    );
  });
}

/**
 * The plate with the name of a new zone. It is shown over the HUD scene, does not take
 * taps, and drops in from above, hangs, then leaves upwards.
 */
export class ZoneBanner {
  private readonly root: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private hangTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    bakePlate(scene);
    const plate = scene.add.image(0, shadowOffset / 2, TEXTURE);
    this.label = createStrokedText(
      scene,
      0,
      0,
      '',
      ZONE_BANNER.fontSize,
      PALETTE.textDark,
      PALETTE.panel,
      0,
    );
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
    this.label.setText(t(`zone.${zone.id}.name`));
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
