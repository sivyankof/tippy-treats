import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { FACE_TEXTURES } from './face-textures';
import { acquireLayerArt, artWidth, colorIndexFor, releaseLayerArt } from './layer-art';

export type MouthKind = 'smile' | 'o';

/**
 * One cake layer: a baked picture (shadow, body, glaze, gloss) and a face on top.
 * The container sits on the centre of the layer.
 */
export class LayerView extends Phaser.GameObjects.Container {
  private readonly art: Phaser.GameObjects.Image;
  private readonly face: Phaser.GameObjects.Container;
  private readonly eyeL: Phaser.GameObjects.Image;
  private readonly eyeR: Phaser.GameObjects.Image;
  private readonly pupilL: Phaser.GameObjects.Image;
  private readonly pupilR: Phaser.GameObjects.Image;
  private readonly mouth: Phaser.GameObjects.Image;
  private readonly cheekL: Phaser.GameObjects.Image;
  private readonly cheekR: Phaser.GameObjects.Image;
  private artKey: string | null = null;
  private drawnColor = -1;
  private drawnWidth = -1;
  private faceEnabled = true;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.art = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);

    const image = (key: string): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, 0, 0, key);
    this.eyeL = image(FACE_TEXTURES.eye);
    this.eyeR = image(FACE_TEXTURES.eye);
    this.pupilL = image(FACE_TEXTURES.pupil);
    this.pupilR = image(FACE_TEXTURES.pupil);
    this.mouth = image(FACE_TEXTURES.mouthSmile).setPosition(0, ANIM.face.mouthOffsetY);
    this.cheekL = image(FACE_TEXTURES.cheek).setPosition(
      -ANIM.face.cheekSpacing / 2,
      ANIM.face.cheekOffsetY,
    );
    this.cheekR = image(FACE_TEXTURES.cheek).setPosition(
      ANIM.face.cheekSpacing / 2,
      ANIM.face.cheekOffsetY,
    );
    this.face = new Phaser.GameObjects.Container(scene, 0, ANIM.face.centerY, [
      this.cheekL,
      this.cheekR,
      this.mouth,
      this.eyeL,
      this.eyeR,
      this.pupilL,
      this.pupilR,
    ]);
    this.eyeL.setX(-ANIM.face.eyeSpacing / 2);
    this.eyeR.setX(ANIM.face.eyeSpacing / 2);
    this.lookAt(0, 0);

    this.add([this.art, this.face]);
    scene.add.existing(this);
  }

  /** Shows the baked art for the colour and width; baking happens only for a new combination. */
  setLayer(index: number, width: number): this {
    const color = colorIndexFor(index);
    const w = artWidth(width);
    if (color === this.drawnColor && w === this.drawnWidth) return this;
    const key = acquireLayerArt(this.scene, color, w);
    if (this.artKey) releaseLayerArt(this.scene, this.artKey);
    this.artKey = key;
    this.drawnColor = color;
    this.drawnWidth = w;
    this.art.setTexture(key).setVisible(true);
    this.layoutFace(w);
    return this;
  }

  override destroy(fromScene?: boolean): void {
    if (this.artKey) releaseLayerArt(this.scene, this.artKey);
    this.artKey = null;
    super.destroy(fromScene);
  }

  /** Pieces that fall off the tower have no face. */
  setFaceEnabled(enabled: boolean): this {
    this.faceEnabled = enabled;
    this.layoutFace(Math.max(this.drawnWidth, 0));
    return this;
  }

  /** Points the pupils towards a vector given in layer-local pixels. */
  lookAt(dx: number, dy: number): this {
    const { pupilMaxOffset, lookRange, eyeSpacing } = ANIM.face;
    const length = Math.hypot(dx, dy);
    const reach = length === 0 ? 0 : (Math.min(length / lookRange, 1) * pupilMaxOffset) / length;
    const ox = dx * reach;
    const oy = dy * reach;
    this.pupilL.setPosition(-eyeSpacing / 2 + ox, oy);
    this.pupilR.setPosition(eyeSpacing / 2 + ox, oy);
    return this;
  }

  setMouth(kind: MouthKind): this {
    this.mouth.setTexture(kind === 'o' ? FACE_TEXTURES.mouthO : FACE_TEXTURES.mouthSmile);
    return this;
  }

  private layoutFace(width: number): void {
    const { fullWidth, eyesOnlyWidth } = ANIM.face;
    this.face.setVisible(this.faceEnabled && width > 0);
    this.face.setScale(Math.min(1, width / fullWidth));
    const showRest = width >= eyesOnlyWidth;
    this.mouth.setVisible(showRest);
    this.cheekL.setVisible(showRest);
    this.cheekR.setVisible(showRest);
  }
}
