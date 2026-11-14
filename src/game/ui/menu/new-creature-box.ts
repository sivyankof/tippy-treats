import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { shade } from '../../../util/color';

const cfg = MENU.newCreature;

/** The gift box of the reveal, drawn in code: a body with a ribbon and a lid with a bow. */
export class GiftBox extends Phaser.GameObjects.Container {
  readonly base: Phaser.GameObjects.Graphics;
  readonly lid: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const size = cfg.boxSize;
    const half = size / 2;
    const lidH = cfg.lidHeight;
    this.base = scene.add.graphics();
    this.base.fillStyle(shade(cfg.box, cfg.shade), 1);
    this.base.fillRoundedRect(-half, -half + lidH, size, size - lidH, cfg.boxRadius);
    this.base.fillStyle(cfg.box, 1);
    this.base.fillRoundedRect(-half, -half + lidH, size, size - lidH - cfg.boxDepth, cfg.boxRadius);
    this.base.fillStyle(cfg.ribbon, 1);
    this.base.fillRect(-cfg.ribbonWidth / 2, -half + lidH, cfg.ribbonWidth, size - lidH);

    // The lid pivots around its own centre, which sits at the top of the box.
    this.lid = scene.add.graphics();
    const lidW = size + cfg.lidOverhang * 2;
    this.lid.fillStyle(shade(cfg.boxLid, cfg.shade), 1);
    this.lid.fillRoundedRect(-lidW / 2, -lidH / 2 + cfg.lidDepth, lidW, lidH, cfg.boxRadius);
    this.lid.fillStyle(cfg.boxLid, 1);
    this.lid.fillRoundedRect(-lidW / 2, -lidH / 2, lidW, lidH - cfg.lidDepth, cfg.boxRadius);
    this.lid.fillStyle(cfg.ribbon, 1);
    this.lid.fillRect(-cfg.ribbonWidth / 2, -lidH / 2, cfg.ribbonWidth, lidH - cfg.lidDepth);
    this.lid.fillCircle(-cfg.bowSize / 2, -lidH / 2 - cfg.bowSize * cfg.bowLift, cfg.bowSize / 2);
    this.lid.fillCircle(cfg.bowSize / 2, -lidH / 2 - cfg.bowSize * cfg.bowLift, cfg.bowSize / 2);
    this.lid.fillStyle(shade(cfg.ribbon, cfg.shade), 1);
    this.lid.fillCircle(0, -lidH / 2 - cfg.bowSize * cfg.bowKnotLift, cfg.bowSize * cfg.bowKnot);
    this.lid.setPosition(0, -half + lidH / 2);

    this.add([this.base, this.lid]);
    scene.add.existing(this);
  }

  /** The lid flies up and away; the body stays. Calls `onDone` when the lid is gone. */
  popLid(onDone?: () => void): void {
    const f = cfg.lidFlight;
    this.scene.tweens.add({
      targets: this.lid,
      y: this.lid.y - f.rise,
      x: f.drift,
      angle: f.spinDeg,
      alpha: 0,
      duration: f.ms,
      ease: 'Quad.easeOut',
      onComplete: onDone,
    });
  }
}
