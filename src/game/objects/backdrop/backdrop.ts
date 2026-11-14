import type * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { BACKDROP } from '../../../data/backdrop';
import { ZONES, type ZoneId } from '../../../data/zones';
import { DEPTH } from '../../depth';
import { collectBakeSteps, type BakeStep } from '../../ui/bake-texture';
import { bakeSharedArt } from './art-kit';
import { cloudsArt } from './clouds-zone';
import { Counter } from './worktop';
import { kitchenArt } from './kitchen-zone';
import type { FrameCtx } from './life';
import { roofArt } from './roof-zone';
import { showcaseArt } from './showcase-zone';
import { spaceArt } from './space-zone';
import { starsArt } from './stars-zone';
import { ZoneFade } from './zone-fade';
import { ZoneScenery, type ZoneArt } from './zone-scenery';

const ZONE_ART: Record<ZoneId, ZoneArt> = {
  kitchen: kitchenArt,
  showcase: showcaseArt,
  roof: roofArt,
  clouds: cloudsArt,
  stars: starsArt,
  space: spaceArt,
};

function zoneIdOf(index: number): ZoneId {
  const zone = ZONES[Math.min(Math.max(index, 0), ZONES.length - 1)];
  return zone ? zone.id : 'kitchen';
}

/**
 * The scenery of a run: the backdrop of the current zone (sky, four parallax layers and
 * background life) and the counter under the tray. When the zone changes, the new
 * backdrop fades in over the old one; the run does not wait for it.
 */
export class Backdrop {
  private readonly fade: ZoneFade;
  private readonly sceneries = new Map<number, ZoneScenery>();
  private readonly counter: Counter;
  private readonly ctx: FrameCtx;
  /** Bakes of the next zone still to do, one texture per frame. */
  private bakeQueue: BakeStep[] = [];
  private lastNowMs: number;
  private scrollY = 0;

  /** `zoneIndex` is the zone shown at once (a debug start can begin deep in the tower). */
  constructor(
    private readonly scene: Phaser.Scene,
    trayTopY: number,
    width: number,
    height: number,
    zoneIndex: number,
  ) {
    this.fade = new ZoneFade(zoneIndex, BACKDROP.fadeMs);
    this.lastNowMs = scene.time.now;
    this.ctx = { timeMs: scene.time.now, deltaMs: 0, width, height };
    this.counter = new Counter(scene, trayTopY, width);
    this.ensure(zoneIndex);
    this.prepareNext(zoneIndex);
  }

  /** The zone the run is in now; a change starts the cross-fade into it. */
  setZone(zoneIndex: number): void {
    if (zoneIndex === this.fade.current) return;
    this.ensure(zoneIndex);
    this.fade.goTo(zoneIndex);
    this.prepareNext(zoneIndex);
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    this.ctx.width = width;
    this.ctx.height = height;
    for (const scenery of this.sceneries.values()) scenery.resize(width, height);
  }

  /** Call every frame with the camera scroll. */
  update(scrollY: number): void {
    this.scrollY = scrollY;
    const now = this.scene.time.now;
    const ctx = this.ctx;
    ctx.deltaMs = Math.min(Math.max(now - this.lastNowMs, 0), ANIM.fx.maxSimMs);
    ctx.timeMs = now;
    this.lastNowMs = now;
    this.fade.update(ctx.deltaMs);
    for (const [index, scenery] of this.sceneries) {
      const alpha = this.fade.alphaOf(index);
      if (alpha === 0 && index !== this.fade.current) {
        scenery.destroy();
        this.sceneries.delete(index);
        continue;
      }
      scenery.setAlpha(alpha);
      scenery.update(ctx, scrollY);
    }
    this.bakeQueue.shift()?.();
    this.counter.update(ctx.timeMs);
  }

  private ensure(index: number): void {
    if (this.sceneries.has(index)) return;
    const id = zoneIdOf(index);
    this.bake(id);
    const depth = DEPTH.background + BACKDROP.depthBase + index * BACKDROP.depthStep;
    const scenery = new ZoneScenery(
      this.scene,
      id,
      depth,
      ZONE_ART[id].build(this.scene),
      this.ctx.width,
      this.ctx.height,
    );
    scenery.setAlpha(this.fade.alphaOf(index));
    scenery.update(this.ctx, this.scrollY);
    this.sceneries.set(index, scenery);
  }

  private bake(id: ZoneId): void {
    bakeSharedArt(this.scene);
    ZONE_ART[id].bake(this.scene);
  }

  /**
   * Queues the pictures of the next zone a little after this one starts, so the change
   * itself is cheap; the queue is worked off one texture per frame, so no frame hitches.
   */
  private prepareNext(index: number): void {
    const next = ZONES[index + 1];
    if (!next) return;
    this.scene.time.delayedCall(BACKDROP.prepareDelayMs, () => {
      this.bakeQueue = collectBakeSteps(() => this.bake(next.id));
    });
  }
}
