export type PressOutcome = 'tap' | 'drop' | 'none';

/**
 * Tells a tap, a long press and a drag apart for one pointer. A press that moves past
 * `dragStartPx` becomes a drag (and can no longer be a long press or a tap); a press that
 * is held `longPressMs` without moving is a long press (and ends without a tap).
 */
export class PressGesture {
  private phase: 'idle' | 'pressed' | 'dragging' | 'spent' = 'idle';
  private startX = 0;
  private startY = 0;
  private startMs = 0;

  constructor(
    private readonly longPressMs: number,
    private readonly dragStartPx: number,
  ) {}

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get dragging(): boolean {
    return this.phase === 'dragging';
  }

  begin(x: number, y: number, timeMs: number): void {
    this.phase = 'pressed';
    this.startX = x;
    this.startY = y;
    this.startMs = timeMs;
  }

  /** True the moment a drag starts. */
  move(x: number, y: number): boolean {
    if (this.phase !== 'pressed') return false;
    if (Math.hypot(x - this.startX, y - this.startY) < this.dragStartPx) return false;
    this.phase = 'dragging';
    return true;
  }

  /** True once, when the press has been held long enough. */
  holdReached(timeMs: number): boolean {
    if (this.phase !== 'pressed' || timeMs - this.startMs < this.longPressMs) return false;
    this.phase = 'spent';
    return true;
  }

  end(): PressOutcome {
    const phase = this.phase;
    this.phase = 'idle';
    if (phase === 'pressed') return 'tap';
    return phase === 'dragging' ? 'drop' : 'none';
  }

  cancel(): void {
    this.phase = 'idle';
  }
}
