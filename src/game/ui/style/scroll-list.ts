import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { ScrollPhysics } from './scroll-physics';

const cfg = MENU.style.scroll;

/**
 * A vertical list that scrolls under the header of a screen: drag a finger (it keeps gliding
 * after it is lifted) or turn the wheel. Put the blocks in `content` (y = 0 is the top of the
 * list, x = 0 the middle of the screen) and slide `root` with the screen transition.
 *
 * It does not clip: the screen draws a band over its header (`ScreenHeader` with `band`), the
 * list runs under it and off the bottom edge. Taps on buttons of the list go through `guard`, so
 * a drag that began on a button scrolls instead of pressing it. Call `tick` every frame.
 */
export class ScrollList {
  /** Moves with the screen transition; never scrolls. */
  readonly root: Phaser.GameObjects.Container;
  /** The blocks; scrolls. */
  readonly content: Phaser.GameObjects.Container;
  private top = 0;
  private viewHeight = 0;
  private contentHeight = 0;
  private enabled = true;
  private readonly physics: ScrollPhysics;

  constructor(private readonly scene: Phaser.Scene) {
    this.content = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [this.content]);
    this.physics = new ScrollPhysics(
      () => this.maxOffset,
      () => scene.time.now,
    );
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Where the list stands on a screen `width` x `height`; the visible part starts at `top`. */
  layout(width: number, height: number, top: number): void {
    this.root.setX(width / 2);
    this.top = top;
    this.viewHeight = height - top;
    this.apply();
  }

  /** The height of everything in `content`. */
  setContentHeight(height: number): void {
    this.contentHeight = height;
    this.apply();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.physics.release();
  }

  /** A tap handler that does nothing when the press turned into a drag. */
  guard<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
    return (...args) => {
      if (!this.physics.wasDragged) handler(...args);
    };
  }

  /** Glides on after a throw; call every frame. */
  tick(deltaMs: number): void {
    if (this.physics.tick(deltaMs)) this.apply();
  }

  private get maxOffset(): number {
    return Math.max(0, this.contentHeight + cfg.endPad - this.viewHeight);
  }

  /** Clamps the offset and moves the content. */
  private apply(): void {
    this.physics.clamp();
    this.content.setY(this.top - this.physics.offset);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    this.physics.down(pointer.y, this.enabled && pointer.y >= this.top);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.physics.move(pointer.y, pointer.isDown)) this.apply();
  }

  private onUp(): void {
    this.physics.up();
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (!this.enabled) return;
    this.physics.wheel(dy);
    this.apply();
  }

  private destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }
}
