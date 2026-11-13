import { ANIM } from '../../data/anim';
import { frameLerp } from '../../util/math';

/** The frozen sway counts as caught up with the simulation below this share. */
const HOLD_EPSILON = 0.01;

/**
 * The sway of the tower can stand still for a moment (a sneeze) and then catch up with the
 * simulation. This keeps the sway shown last frame per layer, holds it while frozen and blends
 * it back into the live sway.
 */
export class SwayHold {
  /** Sway shown last frame, per layer: the pose the tower holds while it is frozen. */
  private readonly shown = new Map<number, number>();
  private held: Map<number, number> | null = null;
  private holdMs = 0;
  /** 1 while frozen, then fades to 0 as the sway catches up with the simulation. */
  private blend = 0;
  /** Speed of the return to the live sway after a freeze. */
  private catchUpLerp: number = ANIM.sneeze.catchUpLerp;

  /** Starts a frame: nothing is shown yet. */
  beginFrame(): void {
    this.shown.clear();
  }

  /** Remembers the sway that was shown for a layer this frame. */
  note(index: number, offset: number): void {
    this.shown.set(index, offset);
  }

  /** The sway shown for a layer in the latest frame (0 for a layer that was not shown). */
  shownOffset(index: number): number {
    return this.shown.get(index) ?? 0;
  }

  /** Holds the sway of the last shown frame for `ms`, then lets it catch up at `catchUpLerp`. */
  freeze(ms: number, catchUpLerp: number = ANIM.sneeze.catchUpLerp): void {
    this.held = new Map(this.shown);
    this.holdMs = ms;
    this.blend = 1;
    this.catchUpLerp = catchUpLerp;
  }

  /** The sway of a layer: its live value, pulled towards the held one while a freeze lasts. */
  apply(index: number, live: number): number {
    if (this.blend <= 0 || !this.held) return live;
    // A layer that landed in the frozen step has no held pose of its own: it rides on the layer below.
    const held = this.held.get(index) ?? this.held.get(index - 1);
    if (held === undefined) return live;
    return live + (held - live) * this.blend;
  }

  /** Counts the freeze down and, once it is over, lets the held sway fade out. */
  advance(dtMs: number): void {
    if (this.holdMs > 0) {
      this.holdMs -= dtMs;
      return;
    }
    if (this.blend <= 0) return;
    this.blend *= 1 - frameLerp(this.catchUpLerp, dtMs);
    if (this.blend < HOLD_EPSILON) {
      this.blend = 0;
      this.held = null;
    }
  }
}
