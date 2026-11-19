import * as Phaser from 'phaser';
import { BALANCE } from '../../data/tower/balance';
import { PLAIN_TOPPERS, type TopperKind } from '../../data/toppers/plain-toppers';
import { ensureTopperTexture } from '../fx/topper-texture';
import { faceHalfSpan } from '../fx/glaze-growth';
import { plainToppers, restTilt, sideOfOffset, topperOffset, topperSize } from './topper-look';

/** Where a shown topper is in the world, for the hop when the next layer lands. */
export interface TopperWorld {
  kind: TopperKind;
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * The big topper of a plain layer: one baked picture on the top edge beside the face, a child of
 * the layer's `content` so it follows its landing squash, breathing and sway. It shows only while
 * the view allows it (a flying layer, the top layer of the tower) and nothing hides it (a face-less
 * piece, the edge squash). `carry` keeps it where it stood after the layer was bitten on landing.
 */
export class LayerTopper {
  readonly image: Phaser.GameObjects.Image;
  private allowed = false;
  private faceless = false;
  private edgeHidden = false;
  private kind: TopperKind | null = null;
  /** Offset it was moved to by a landing (`null`: the bite took it, `undefined`: its own place). */
  private carry: number | null | undefined;
  /** The side of the face it stands on now (`null`: not shown). */
  private shownSide: -1 | 1 | null = null;
  private readonly matrix = new Phaser.GameObjects.Components.TransformMatrix();
  /** The scale the picture has at rest, and the crouch (a multiple of it) the flying layer above makes it take. */
  private base = { x: 1, y: 1 };
  private crouch = { x: 1, y: 1 };

  constructor(scene: Phaser.Scene) {
    this.image = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);
  }

  /** The view may show a topper (the layer flies or is the top of the tower). */
  setAllowed(on: boolean): void {
    this.allowed = on;
  }

  /** A face-less piece (the bitten-off overhang) carries no topper. */
  setFaceless(on: boolean): void {
    this.faceless = on;
  }

  /** The layer is drawn squashed against the screen edge: the topper would float detached, so it hides. */
  setEdgeHidden(on: boolean): void {
    this.edgeHidden = on;
    if (on) this.image.setVisible(false);
  }

  /** The topper crouches: its scale is `x`, `y` times its own (1, 1 stands straight). */
  setCrouch(x: number, y: number): void {
    this.crouch.x = x;
    this.crouch.y = y;
    this.applyScale();
  }

  private applyScale(): void {
    this.image.setScale(this.base.x * this.crouch.x, this.base.y * this.crouch.y);
  }

  /** The topper stands `dx` from the centre from now on; `null` removes it. */
  setCarry(dx: number | null): void {
    this.carry = dx;
  }

  /** Back to the state of a fresh view. */
  reset(): void {
    this.allowed = false;
    this.faceless = false;
    this.edgeHidden = false;
    this.carry = undefined;
    this.crouch.x = 1;
    this.crouch.y = 1;
    this.image.setVisible(false);
    this.shownSide = null;
  }

  /** The side of the face the shown topper stands on (-1 left, 1 right), or `null` while none is shown. */
  side(): -1 | 1 | null {
    return this.image.visible ? this.shownSide : null;
  }

  /** Shows, moves or hides the topper of the plain layer `layerIndex` (1-based), `width` wide. */
  update(layerIndex: number, width: number, plain: boolean): void {
    plainToppers.note(layerIndex, plain, width);
    const topper =
      this.allowed && plain && !this.faceless && !this.edgeHidden
        ? plainToppers.at(layerIndex)
        : null;
    if (!topper || this.carry === null) {
      this.image.setVisible(false);
      this.shownSide = null;
      return;
    }
    const dx =
      this.carry ?? topperOffset(topper.kind, topper.side, width, faceHalfSpan(width, null));
    if (dx === null) {
      this.image.setVisible(false);
      this.shownSide = null;
      return;
    }
    // The side comes from where it really stands (a carried topper may have crossed the face).
    this.shownSide = sideOfOffset(dx);
    if (this.kind !== topper.kind) {
      this.kind = topper.kind;
      const look = topperSize(topper.kind);
      this.image
        .setTexture(ensureTopperTexture(this.image.scene, topper.kind))
        .setDisplaySize(look.width, look.height)
        .setOrigin(look.originX, look.restY / look.height);
      this.base.x = this.image.scaleX;
      this.base.y = this.image.scaleY;
      this.applyScale();
    }
    this.image
      .setPosition(dx, -BALANCE.layer.height / 2 + PLAIN_TOPPERS.sinkPx)
      .setRotation(restTilt(topper.kind, this.shownSide))
      .setVisible(true);
  }

  /** The topper as it is in the world now, or `null` while none is shown. */
  world(out: TopperWorld): TopperWorld | null {
    if (!this.image.visible || !this.kind) return null;
    const m = this.image.getWorldTransformMatrix(this.matrix);
    out.kind = this.kind;
    out.x = m.tx;
    out.y = m.ty;
    out.rotation = m.rotation;
    out.scaleX = m.scaleX;
    out.scaleY = m.scaleY;
    return out;
  }
}
