import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { createOutlinedText } from '../common/outlined-text';
import { fitText } from '../menu/widgets/fit-text';
import { createPlate, faceOffsetY, VolumePlate } from './volume';

const cfg = MENU.style.frame.tab;

/**
 * A frame of a screen: a window plate with its title on a small tab across the top edge.
 * (0, 0) is the centre of the body; put the content into `content`, whose (0, 0) is the same.
 * `setBody` sizes the plate; the tab stays on its top edge.
 */
export class SectionFrame extends Phaser.GameObjects.Container {
  readonly content: Phaser.GameObjects.Container;
  private plate: VolumePlate | null = null;
  private readonly tab: Phaser.GameObjects.Container;
  private bodyWidth = 0;
  private bodyHeight = 0;

  constructor(scene: Phaser.Scene, title: string) {
    super(scene, 0, 0);
    const label = createOutlinedText(scene, 0, 0, title, cfg.font);
    const width = label.width + cfg.padX * 2;
    const plate = createPlate(scene, 'chip', 0, 0, width, cfg.height, { fill: cfg.fill });
    label.setY(faceOffsetY('chip'));
    fitText(label, width - cfg.padX);
    this.tab = new Phaser.GameObjects.Container(scene, 0, 0, [plate, label]);
    this.content = new Phaser.GameObjects.Container(scene, 0, 0);
    this.add([this.content, this.tab]);
    scene.add.existing(this);
  }

  /** Height of the tab above the top edge of the body. */
  static get tabRise(): number {
    return cfg.height / 2;
  }

  get frameWidth(): number {
    return this.bodyWidth;
  }

  get frameHeight(): number {
    return this.bodyHeight;
  }

  /** Sizes the plate (baked once per height, stretched sideways) and moves the tab onto its top edge. */
  setBody(width: number, height: number): this {
    if (!this.plate || this.plate.bodyHeight !== Math.round(height)) {
      this.plate?.destroy();
      this.plate = createPlate(this.scene, 'window', 0, 0, width, height);
      this.addAt(this.plate, 0);
    }
    this.plate.setBodyWidth(width);
    this.bodyWidth = width;
    this.bodyHeight = height;
    this.tab.setY(-height / 2);
    return this;
  }
}
