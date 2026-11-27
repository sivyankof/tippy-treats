import { MENU } from '../../../data/common/menu-layout';

const cfg = MENU.style.scroll;

/** Where a finger stood at some moment, for the speed of the throw. */
interface Sample {
  at: number;
  y: number;
}

/**
 * The feel of a vertical scroll without any drawing: dragging a finger, the glide after a throw
 * and the wheel, on one number, `offset` (0 at the start, up to `maxOffset()`). `ScrollList` and
 * the climb map ribbon both move their objects by it. Positive speed scrolls towards a bigger offset.
 */
export class ScrollPhysics {
  offset = 0;
  /** Glide speed in px per ms. */
  private speed = 0;
  private press: { startY: number; lastY: number; moved: boolean; samples: Sample[] } | null = null;
  private dragged = false;

  constructor(
    private readonly maxOffset: () => number,
    private readonly now: () => number,
  ) {}

  /** The last press became a drag, or landed on a gliding list: a button under it must not fire. */
  get wasDragged(): boolean {
    return this.dragged;
  }

  /** Clamps the offset to the range; true when the clamp changed it. */
  clamp(): boolean {
    const clamped = Math.min(Math.max(this.offset, 0), this.maxOffset());
    const hit = clamped !== this.offset;
    this.offset = clamped;
    return hit;
  }

  /** Puts the list at `offset` and stops any glide. */
  jump(offset: number): void {
    this.speed = 0;
    this.offset = offset;
    this.clamp();
  }

  /** Stops the press and the glide. */
  release(): void {
    this.press = null;
    this.speed = 0;
  }

  /** A finger went down at `y`; `allowed` is false when it landed where a drag must not start. */
  down(y: number, allowed: boolean): void {
    // A finger that lands on a gliding list only stops it: it must not press the button under it.
    this.dragged = Math.abs(this.speed) > 0;
    this.speed = 0;
    if (!allowed) return;
    this.press = { startY: y, lastY: y, moved: false, samples: [] };
  }

  /** The finger moved to `y` (`unit` canvas pixels per screen pixel of the list); true when the offset changed. */
  move(y: number, isDown: boolean, unit = 1): boolean {
    const press = this.press;
    if (!press || !isDown) return false;
    if (!press.moved && Math.abs(y - press.startY) > cfg.dragPx) {
      press.moved = true;
      this.dragged = true;
    }
    if (!press.moved) return false;
    this.offset -= (y - press.lastY) / unit;
    press.lastY = y;
    this.clamp();
    const now = this.now();
    press.samples.push({ at: now, y });
    while (press.samples.length > 1 && now - (press.samples[0]?.at ?? now) > cfg.speedWindowMs) {
      press.samples.shift();
    }
    return true;
  }

  /** The finger was lifted: a drag becomes a throw. */
  up(unit = 1): void {
    const press = this.press;
    this.press = null;
    if (!press?.moved) return;
    const first = press.samples[0];
    const last = press.samples[press.samples.length - 1];
    const span = first && last ? last.at - first.at : 0;
    this.speed = first && last && span > 0 ? -(last.y - first.y) / span / unit : 0;
    // A finger that rested before lifting does not throw.
    if (this.now() - (last?.at ?? 0) > cfg.speedWindowMs) this.speed = 0;
  }

  /** A wheel turn of `dy` pixels. */
  wheel(dy: number): void {
    this.speed = 0;
    this.offset += dy * cfg.wheelScale;
    this.clamp();
  }

  /** Glides on after a throw; true when the offset moved. Call every frame. */
  tick(deltaMs: number): boolean {
    if (this.press || this.speed === 0) return false;
    this.offset += this.speed * deltaMs;
    this.speed *= Math.pow(cfg.friction, deltaMs / cfg.frictionFrameMs);
    if (Math.abs(this.speed) < cfg.stopSpeed) this.speed = 0;
    if (this.clamp()) this.speed = 0;
    return true;
  }
}
