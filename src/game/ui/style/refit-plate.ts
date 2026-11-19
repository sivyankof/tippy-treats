import type * as Phaser from 'phaser';
import { VolumePlate, type VolumeColors, type VolumeKind } from './volume';

/**
 * A plate of the kit whose height follows the room it must cover (a header band or a bar that
 * reaches the screen edge under the safe band). The baked picture has a fixed height, so a new
 * height makes a new plate that takes the old one's place in its list, position and look. The
 * heights are whole pixels and the plate is only rebuilt when the height changes.
 */
export class RefitPlate {
  private current: VolumePlate;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kind: VolumeKind,
    height: number,
    private readonly colors: VolumeColors = {},
    /** The container that holds the plate; none: the plate is in the scene's own list. */
    private readonly parent: Phaser.GameObjects.Container | null = null,
  ) {
    this.current = new VolumePlate(scene, kind, Math.round(height), colors);
  }

  /** The plate now on show; it changes when the height does. */
  get plate(): VolumePlate {
    return this.current;
  }

  /** Makes the plate `height` tall (the body, without its shadow); returns the plate on show. */
  setBodyHeight(height: number): VolumePlate {
    const rounded = Math.round(height);
    if (rounded === this.current.bodyHeight) return this.current;
    const old = this.current;
    const next = new VolumePlate(this.scene, this.kind, rounded, this.colors);
    next
      .setBodyWidth(old.bodyWidth)
      .setPosition(old.x, old.y)
      .setDepth(old.depth)
      .setAlpha(old.alpha)
      .setVisible(old.visible);
    if (this.parent) this.parent.replace(old, next, true);
    else {
      this.scene.children.moveTo(next, this.scene.children.getIndex(old));
      old.destroy();
    }
    this.current = next;
    return next;
  }
}
