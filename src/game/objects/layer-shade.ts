import * as Phaser from 'phaser';
import { BALANCE } from '../../data/tower/balance';
import { PLAIN_LAYER } from '../../data/tower/plain-layers';
import { bakeTexture } from '../ui/bake-texture';
import { layerBox } from './layer-draw';
import { shadeSegments, type ShadeSpan } from './overlap-shade';

const STRIP_KEY = 'shade_strip';
/** Width of the flat strip picture; it is stretched sideways to the overlap. */
const STRIP_WIDTH = 4;

const capKey = (radius: number): string => `shade_cap_${radius}`;

/** Bakes the flat strip and the corner piece for the given inner radius (the full-width one by default). */
export function bakeShadeTextures(
  scene: Phaser.Scene,
  radius: number = layerBox(BALANCE.tray.width).innerRadius,
): void {
  const { color, alpha, height } = PLAIN_LAYER.overlapShade;
  const r = Math.max(1, Math.round(radius));
  bakeTexture(scene, STRIP_KEY, STRIP_WIDTH, height, (g) => {
    g.fillStyle(color, alpha);
    g.fillRect(0, 0, STRIP_WIDTH, height);
  });
  bakeTexture(scene, capKey(r), r, height, (g) => {
    g.fillStyle(color, alpha);
    // A rounded corner larger than the picture; the texture crops it to the band.
    g.fillRoundedRect(0, 0, r * 2, r * 2, { tl: r, tr: 0, bl: 0, br: 0 });
  });
}

/**
 * The shade a layer lays on the one below: a flat band along the top of the lower layer,
 * exactly as wide as the overlap, with rounded ends where it reaches a corner. Made of three
 * baked pictures that are only moved, scaled and cropped when the overlap changes.
 */
export class LayerShade {
  readonly parts: Phaser.GameObjects.Image[];
  private readonly middle: Phaser.GameObjects.Image;
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;
  private radius = -1;

  constructor(private readonly scene: Phaser.Scene) {
    const make = (key: string): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, 0, 0, key).setOrigin(0, 0).setVisible(false);
    bakeShadeTextures(scene);
    this.middle = make(STRIP_KEY);
    const key = capKey(this.cap(layerBox(BALANCE.tray.width).innerRadius));
    this.left = make(key);
    this.right = make(key).setFlipX(true);
    this.parts = [this.middle, this.left, this.right];
  }

  private cap(radius: number): number {
    return Math.max(1, Math.round(radius));
  }

  /** Lays the shade of an upper layer (centre `upperX`, width `upperW`) on this one (centre `lowerX`, width `lowerW`). */
  set(lowerX: number, lowerW: number, upperX: number, upperW: number): void {
    const box = layerBox(lowerW);
    const seg = shadeSegments(box, lowerX, upperX, upperW);
    const height = PLAIN_LAYER.overlapShade.height;
    const top = box.innerTop;
    const r = this.cap(box.innerRadius);
    if (r !== this.radius) {
      this.radius = r;
      bakeShadeTextures(this.scene, r);
      this.left.setTexture(capKey(r));
      this.right.setTexture(capKey(r));
    }
    if (seg.middle) {
      this.middle
        .setPosition(seg.middle.x0, top)
        .setDisplaySize(seg.middle.x1 - seg.middle.x0, height)
        .setVisible(true);
    } else this.middle.setVisible(false);
    this.cornerPiece(this.left, seg.left, top, height, box.innerLeft, false);
    this.cornerPiece(this.right, seg.right, top, height, box.innerRight, true);
  }

  /** The layer has nothing on it (it is the top one): no shade. */
  clear(): void {
    for (const part of this.parts) part.setVisible(false);
  }

  private cornerPiece(
    image: Phaser.GameObjects.Image,
    span: ShadeSpan | null,
    top: number,
    height: number,
    edge: number,
    mirrored: boolean,
  ): void {
    if (!span) {
      image.setVisible(false);
      return;
    }
    const r = image.width;
    // The picture sits at the layer's edge (the mirrored one against it, inside); a crop is in
    // the picture's own displayed coordinates, which Phaser flips for a flipped image.
    const left = mirrored ? edge - r : edge;
    image
      .setPosition(left, top)
      .setCrop(span.x0 - left, 0, span.x1 - span.x0, height)
      .setVisible(true);
  }
}
