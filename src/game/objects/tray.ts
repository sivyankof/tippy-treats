import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { IDLE_MOTION, IDLE_PHASE, TRAY_SHEEN } from '../../data/idle-motion';
import { KITCHEN_COLORS } from '../../data/palette';
import { DEPTH } from '../depth';
import { createGlossBand, sweepGloss } from '../fx/gloss-sweep';
import { bakeTexture } from '../ui/bake-texture';
import { applyIdlePose, idlePose, type IdlePose } from '../ui/idle-motion';

const TRAY_TEXTURE = 'tray';
const TRAY_SHADOW_WIDTH_RATIO = 1.04;

function bakeTray(scene: Phaser.Scene, texW: number, texH: number): void {
  const { thickness, radius, outline, shadowHeight, shadowAlpha } = ANIM.tray;
  const w = BALANCE.tray.width;
  const left = (texW - w) / 2;
  bakeTexture(scene, TRAY_TEXTURE, texW, texH, (g) => {
    g.fillStyle(KITCHEN_COLORS.trayShadow, shadowAlpha);
    g.fillEllipse(texW / 2, thickness + shadowHeight / 3, texW, shadowHeight);
    g.fillStyle(KITCHEN_COLORS.trayShadow, 1);
    g.fillRoundedRect(left, 0, w, thickness, radius);
    g.fillStyle(KITCHEN_COLORS.tray, 1);
    g.fillRoundedRect(
      left + outline / 2,
      outline / 2,
      w - outline,
      thickness - outline * 1.5,
      radius - outline / 2,
    );
  });
}

/**
 * The tray and its shadow: one baked picture where the tower stands. It settles a little under
 * the tower's weight and back all the time, and a sheen runs over it every few seconds.
 */
export class Tray {
  private readonly image: Phaser.GameObjects.Image;
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly sheenTravel: number;
  private readonly pose: IdlePose = { scaleX: 1, scaleY: 1, angle: 0, bob: 0 };
  private nextSheenMs: number = TRAY_SHEEN.everyMs;

  constructor(scene: Phaser.Scene, trayTopY: number) {
    const { thickness, shadowHeight, outline } = ANIM.tray;
    const texW = 2 * Math.ceil((BALANCE.tray.width * TRAY_SHADOW_WIDTH_RATIO) / 2);
    bakeTray(scene, texW, thickness + shadowHeight);
    this.image = scene.add
      .image(BALANCE.tray.centerX, trayTopY, TRAY_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.tray);
    this.sheen = createGlossBand(scene, thickness - outline * 2 - TRAY_SHEEN.inset);
    scene.add
      .container(BALANCE.tray.centerX, trayTopY + thickness / 2, [this.sheen])
      .setDepth(DEPTH.tray + 1);
    this.sheenTravel = BALANCE.tray.width / 2 - ANIM.tray.radius - ANIM.perfect.glossSweepWidth / 2;
  }

  /** `timeMs` is the clock of the run: it drives the settle and the sheen. */
  tick(timeMs: number): void {
    const pose = idlePose(IDLE_MOTION.tray, timeMs, IDLE_PHASE.tray, this.pose);
    applyIdlePose(this.image, pose);
    if (timeMs >= this.nextSheenMs) {
      this.nextSheenMs = timeMs + TRAY_SHEEN.everyMs;
      sweepGloss(this.sheen, this.sheenTravel, TRAY_SHEEN.durationMs, TRAY_SHEEN.alpha);
    }
  }
}
