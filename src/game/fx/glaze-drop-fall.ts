import * as Phaser from 'phaser';
import { DEPTH } from '../depth';
import { fallTimeMs } from './glaze-growth';

/** Where a falling drop lands: the layer (0-based index) and the world point. */
export interface DropLanding {
  index: number;
  x: number;
  y: number;
  /** Texture of the spot it leaves, and how long the spot stays compared with a glaze spot. */
  spot: string;
  holdMul: number;
}

/** A drop that stretches into a thread before it breaks off: it sinks `px` in `ms`, tied by a thread `width` wide. */
export interface DropThread {
  ms: number;
  px: number;
  width: number;
  /** Texture of the thread: a slice of the drip stem, stretched. */
  texture: string;
  /** Width of that slice picture. */
  textureWidth: number;
}

interface FallingDrop {
  image: Phaser.GameObjects.Image;
  thread: Phaser.GameObjects.Image | null;
  spec: DropThread | null;
  /** Where the drop was when it left, and where it starts its free fall. */
  originY: number;
  startY: number;
  ageMs: number;
  fallMs: number;
  landing: DropLanding;
}

/** The thread stretches with an ease-in: slow at first, then it gives way. */
function threadSink(t: number): number {
  return t * t;
}

/**
 * Glaze drops that fall from grown drips onto the layer below: each one accelerates down and,
 * when it gets there, hands its landing to `onLand` (the layer below gets a spot). Pooled.
 */
export class GlazeDropFall {
  private readonly live: FallingDrop[] = [];
  private readonly free: Phaser.GameObjects.Image[] = [];
  private readonly freeThreads: Phaser.GameObjects.Image[] = [];
  onLand: ((landing: DropLanding) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * A drop (picture `texture`, its bottom at (x, y)) starts to fall to `landing`; with `thread`
   * it first sinks on a thread that then breaks.
   */
  spawn(
    x: number,
    y: number,
    texture: string,
    landing: DropLanding,
    thread: DropThread | null = null,
  ): void {
    const image =
      this.free.pop() ??
      this.scene.add.image(0, 0, texture).setOrigin(0.5, 1).setDepth(DEPTH.drips);
    image.setTexture(texture).setPosition(x, y).setAlpha(1).setVisible(true);
    let line: Phaser.GameObjects.Image | null = null;
    if (thread) {
      line =
        this.freeThreads.pop() ??
        this.scene.add.image(0, 0, thread.texture).setOrigin(0.5, 0).setDepth(DEPTH.drips);
      line.setTexture(thread.texture).setPosition(x, y).setScale(0).setVisible(true);
    }
    const startY = thread ? y + thread.px : y;
    this.live.push({
      image,
      thread: line,
      spec: thread,
      originY: y,
      startY,
      ageMs: 0,
      fallMs: fallTimeMs(landing.y - startY),
      landing,
    });
  }

  update(dtMs: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const drop = this.live[i]!;
      drop.ageMs += dtMs;
      const spec = drop.spec;
      if (spec && drop.ageMs < spec.ms) {
        this.stretch(drop, spec, drop.ageMs / spec.ms);
        continue;
      }
      if (drop.thread) this.snapThread(drop);
      const fallAge = drop.ageMs - (spec ? spec.ms : 0);
      const t = Math.min(1, fallAge / Math.max(1, drop.fallMs));
      drop.image.setY(drop.startY + (drop.landing.y - drop.startY) * t * t);
      if (t < 1) continue;
      this.retire(i);
      this.onLand?.(drop.landing);
    }
  }

  /** Every falling drop goes (a new run, the tower collapses). */
  clear(): void {
    for (let i = this.live.length - 1; i >= 0; i--) this.retire(i);
  }

  /** The drop sinks on its thread, which runs from where it left to the middle of the drop. */
  private stretch(drop: FallingDrop, spec: DropThread, t: number): void {
    const y = drop.originY + spec.px * threadSink(t);
    drop.image.setY(y);
    const line = drop.thread;
    if (!line) return;
    const top = drop.originY - drop.image.height / 2;
    const length = Math.max(0, y - drop.image.height / 2 - top);
    line.setY(top).setScale(spec.width / spec.textureWidth, length / line.height);
  }

  private snapThread(drop: FallingDrop): void {
    if (!drop.thread) return;
    drop.thread.setVisible(false);
    this.freeThreads.push(drop.thread);
    drop.thread = null;
  }

  private retire(i: number): void {
    const drop = this.live[i]!;
    this.snapThread(drop);
    drop.image.setVisible(false);
    this.free.push(drop.image);
    this.live.splice(i, 1);
  }
}
