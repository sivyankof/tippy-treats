import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';

const cfg = MENU.style.scroll;

/** Where a finger stood at some moment, for the speed of the throw. */
interface Sample {
  at: number;
  y: number;
}

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
  private offset = 0;
  /** Glide speed in px per ms, positive scrolls down the list. */
  private speed = 0;
  private press: { startY: number; lastY: number; moved: boolean; samples: Sample[] } | null = null;
  private dragged = false;
  private enabled = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.content = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [this.content]);
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
    if (!enabled) this.release();
  }

  /** A tap handler that does nothing when the press turned into a drag. */
  guard<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
    return (...args) => {
      if (!this.dragged) handler(...args);
    };
  }

  /** Glides on after a throw; call every frame. */
  tick(deltaMs: number): void {
    if (this.press || this.speed === 0) return;
    this.offset += this.speed * deltaMs;
    this.speed *= Math.pow(cfg.friction, deltaMs / cfg.frictionFrameMs);
    if (Math.abs(this.speed) < cfg.stopSpeed) this.speed = 0;
    if (this.apply()) this.speed = 0;
  }

  private get maxOffset(): number {
    return Math.max(0, this.contentHeight + cfg.endPad - this.viewHeight);
  }

  /** Clamps the offset and moves the content; true when the clamp stopped it. */
  private apply(): boolean {
    const clamped = Phaser.Math.Clamp(this.offset, 0, this.maxOffset);
    const hit = clamped !== this.offset;
    this.offset = clamped;
    this.content.setY(this.top - this.offset);
    return hit;
  }

  private release(): void {
    this.press = null;
    this.speed = 0;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    // A finger that lands on a gliding list only stops it: it must not press the button under it.
    this.dragged = Math.abs(this.speed) > 0;
    this.speed = 0;
    if (!this.enabled || pointer.y < this.top) return;
    this.press = { startY: pointer.y, lastY: pointer.y, moved: false, samples: [] };
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (!press || !pointer.isDown) return;
    if (!press.moved && Math.abs(pointer.y - press.startY) > cfg.dragPx) {
      press.moved = true;
      this.dragged = true;
    }
    if (!press.moved) return;
    this.offset -= pointer.y - press.lastY;
    press.lastY = pointer.y;
    this.apply();
    const now = this.scene.time.now;
    press.samples.push({ at: now, y: pointer.y });
    while (press.samples.length > 1 && now - (press.samples[0]?.at ?? now) > cfg.speedWindowMs) {
      press.samples.shift();
    }
  }

  private onUp(): void {
    const press = this.press;
    this.press = null;
    if (!press?.moved) return;
    const first = press.samples[0];
    const last = press.samples[press.samples.length - 1];
    const span = first && last ? last.at - first.at : 0;
    this.speed = first && last && span > 0 ? -(last.y - first.y) / span : 0;
    // A finger that rested before lifting does not throw.
    if (this.scene.time.now - (last?.at ?? 0) > cfg.speedWindowMs) this.speed = 0;
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (!this.enabled) return;
    this.speed = 0;
    this.offset += dy * cfg.wheelScale;
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
