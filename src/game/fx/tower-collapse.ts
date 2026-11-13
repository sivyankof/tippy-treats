import { ANIM } from '../../data/anim';
import { pickRange } from '../../util/math';
import type { TowerView } from '../objects/tower-view';
import { collapseDelayMs, collapseDurationMs } from './anim-curves';
import { easeFn } from './ease';
import type { FallingPieces } from './falling-piece';

const collapseEase = easeFn(ANIM.collapse.ease);

export interface TowerCollapseOptions {
  tower: TowerView;
  pieces: FallingPieces;
  /** Number of placed layers. */
  count: number;
  /** Camera scroll at the start and the scroll that shows the tray at the end. */
  startScroll: number;
  endScroll: number;
  /** Called for each layer that goes; `seriesIndex` counts from 0 for the first one. */
  onDrop?: (seriesIndex: number) => void;
  random?: () => number;
}

/**
 * The tower falls apart from the top down: each layer becomes a happy piece with a random
 * push, and the camera runs down the tower. The ease shapes the camera and the pace of the
 * pieces together, so a piece is always spawned where the camera is looking.
 */
export class TowerCollapse {
  private readonly durationMs: number;
  private elapsedMs = 0;
  /** 0-based index of the next layer to go; below 0 when all have gone. */
  private next: number;
  private dropped = 0;

  constructor(private readonly opts: TowerCollapseOptions) {
    this.durationMs = opts.count > 0 ? collapseDurationMs(opts.count) : 0;
    this.next = opts.count - 1;
  }

  /** Eased progress 0..1 of the collapse. */
  private get progress(): number {
    if (this.durationMs <= 0) return 1;
    return collapseEase(Math.min(1, this.elapsedMs / this.durationMs));
  }

  /** Camera scroll the collapse wants right now. */
  get scrollY(): number {
    return this.opts.startScroll + (this.opts.endScroll - this.opts.startScroll) * this.progress;
  }

  get done(): boolean {
    return this.next < 0 && this.elapsedMs >= this.durationMs;
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs;
    const reached = this.progress * this.durationMs;
    while (
      this.next >= 0 &&
      collapseDelayMs(this.next, this.opts.count, this.durationMs) <= reached
    ) {
      this.dropLayer(this.next);
      this.next -= 1;
    }
  }

  private dropLayer(index: number): void {
    const { tower, pieces, random, onDrop } = this.opts;
    onDrop?.(this.dropped);
    this.dropped += 1;
    const pose = tower.layerPose(index);
    if (pose) {
      pieces.spawn({
        layerIndex: index + 1,
        x: pose.x,
        y: pose.y,
        width: pose.width,
        cut: pose.cut,
        vx: pickRange(ANIM.collapse.impulseX, random),
        vy: -pickRange(ANIM.collapse.hopSpeed, random),
        spin: pickRange(ANIM.collapse.spinDegPerSec, random),
        gravity: ANIM.collapse.gravity,
        lifeMs: ANIM.collapse.lifeMs,
        face: 'joy',
        angle: pose.angle,
      });
    }
    tower.hideFrom(index);
  }
}
