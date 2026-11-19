import * as Phaser from 'phaser';
import type { GuestLook } from '../../../data/guests/tower-guest';
import { DEPTH } from '../../common/depth';
import { drawFlatLimbs, drawGuestLegs } from './tower-guest-art';
import type { GuestShape } from './tower-guest-plan';

/** Where and how the picture of the guest is put in one frame. */
export interface PictureFrame {
  x: number;
  y: number;
  /** Mirroring: -1 or 1. */
  facing: -1 | 1;
  /** The drawn size before the shape stretches it. */
  size: number;
  /** The guest sits (its legs are drawn). */
  resting: boolean;
  /** The depth when it lies under a layer; `null` for the usual one. */
  pressedDepth: number | null;
  clockMs: number;
  /** The trembling and flailing of the flattened guest ("fewer effects" keeps it still). */
  lively: boolean;
}

/** The body, the legs and the container of the guest: everything that is drawn, none of the logic. */
export class GuestPicture {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly legs: Phaser.GameObjects.Graphics;
  private shownFlat: boolean | null = null;

  constructor(scene: Phaser.Scene) {
    this.body = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT');
    this.legs = new Phaser.GameObjects.Graphics(scene);
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, [this.body, this.legs]);
    this.root.setDepth(DEPTH.pieces).setVisible(false);
    scene.add.existing(this.root);
  }

  show(): void {
    this.root.setVisible(true);
    this.shownFlat = null;
  }

  hide(): void {
    this.root.setVisible(false);
    this.legs.clear();
  }

  /** Places and shapes the picture for this frame. */
  draw(look: GuestLook, shape: GuestShape, frame: PictureFrame): void {
    if (this.shownFlat !== shape.flat) {
      this.shownFlat = shape.flat;
      const { flat } = look;
      this.body.setTexture(shape.flat ? flat.texture : look.texture);
      const height = shape.flat ? flat.height : look.size.height;
      const feet = shape.flat ? flat.height * flat.feetShare : look.feetY;
      this.body.setOrigin(0.5, feet / height);
      const width = shape.flat ? flat.width : look.size.width;
      this.legs.setPosition(-width / 2, -feet);
    }
    this.legs.setVisible(frame.resting || shape.flat);
    if (shape.flat) drawFlatLimbs(this.legs, look, frame.clockMs, frame.lively);
    else if (frame.resting) drawGuestLegs(this.legs, look, frame.clockMs, look.headSide);
    this.root.setDepth(frame.pressedDepth ?? DEPTH.pieces);
    this.root.setPosition(frame.x, frame.y);
    this.root.setRotation(shape.tilt);
    this.root.setScale(frame.facing * frame.size * shape.scaleX, frame.size * shape.scaleY);
  }
}
