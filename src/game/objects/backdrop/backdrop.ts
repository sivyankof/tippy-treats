import * as Phaser from 'phaser';
import { ANIM } from '../../../data/anim';
import { BACKDROP, BD_TEX } from '../../../data/backdrop';
import type { StartPlaceId } from '../../../data/start-places';
import { WEATHER } from '../../../data/weather';
import { SPACE_ZONE_INDEX, ZONES, type ZoneId } from '../../../data/zones';
import type { RunLook } from '../../../core/run-look';
import { flyingLap } from '../../../core/space-laps';
import { DEPTH } from '../../depth';
import { markPerfPart } from '../../perf/perf-marks';
import { collectBakeSteps, type BakeStep } from '../../ui/bake-texture';
import { surfaceScreenY, trayScrollY, travellerClearBand } from '../../camera-layout';
import { bakeSharedArt } from './art-kit';
import { towerLayersAt } from './mountain-placement';
import { wallDownAt } from './wall-anchor';
import { bakeFarArt } from './far-plane';
import { cloudsArt } from './clouds-zone';
import { Counter } from './worktop';
import { kitchenArt } from './kitchen-zone';
import type { GuestSource } from './guest-source';
import type { FrameCtx } from './life';
import { roofArt } from './roof-zone';
import { shopArt } from './shop-zone';
import { showcaseArt } from './showcase-zone';
import { spaceArt } from './space-zone';
import { starsArt } from './stars-zone';
import { ZoneFade } from './zone-fade';
import { weatherShareOf } from './weather-share';
import { bakeSky, ZoneScenery, type SceneryLook, type ZoneArt } from './zone-scenery';

/** What the backdrop needs of the run state: the zone and the placed height (the lap follows from it). */
export interface RunBackdropState {
  zoneIndex: number;
  height: number;
  /** The placed layers, bottom first; the top one's width is the tower top width of a lap. */
  layers: readonly { width: number }[];
}

const ZONE_ART: Record<ZoneId, ZoneArt> = {
  kitchen: kitchenArt,
  showcase: showcaseArt,
  roof: roofArt,
  clouds: cloudsArt,
  stars: starsArt,
  space: spaceArt,
};

/** The art of zone 1 for each start place; a new place is one entry here plus its art file. */
const PLACE_ART: Record<StartPlaceId, ZoneArt> = {
  kitchen: kitchenArt,
  shop: shopArt,
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
  /** Lap of Space of the layer in flight; 0 before Space. */
  private lap: number;
  /** Tower top width when the current lap began (the planet's lap 1 corridor); fixed for the lap. */
  private lapTopWidth: number | undefined;
  /** The picture that stands in for the zones once they are frozen (the results screen). */
  private still: Phaser.GameObjects.Image | null = null;
  /** The zones the still replaced, shown again when it goes. */
  private frozen: ZoneScenery[] = [];

  private readonly alphaOf = (index: number): number => this.fade.alphaOf(index);

  /** `zoneIndex` and `lap` are what is shown at once (a debug start can begin deep in the tower). */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly trayTopY: number,
    width: number,
    height: number,
    state: RunBackdropState,
    readonly look: RunLook,
  ) {
    this.lap = flyingLap(state.height);
    this.lapTopWidth = state.layers.at(-1)?.width;
    this.fade = new ZoneFade(state.zoneIndex, BACKDROP.fadeMs);
    this.lastNowMs = scene.time.now;
    this.ctx = {
      timeMs: scene.time.now,
      deltaMs: 0,
      width,
      height,
      clearBand: travellerClearBand(height),
      towerLayers: 0,
      wallDown: 0,
    };
    this.counter = new Counter(scene, trayTopY, width);
    this.ensure(state.zoneIndex);
    this.prepareNext(state.zoneIndex);
  }

  /**
   * Follows the run: the zone it is in (a change starts the cross-fade into it) and, in Space, the
   * lap (the planet changes). One Space scenery serves every lap.
   */
  follow(state: RunBackdropState): void {
    this.setLap(flyingLap(state.height), state.layers.at(-1)?.width);
    this.setZone(state.zoneIndex);
  }

  private setZone(zoneIndex: number): void {
    if (zoneIndex === this.fade.current) return;
    this.ensure(zoneIndex);
    this.fade.goTo(zoneIndex);
    this.prepareNext(zoneIndex);
  }

  private setLap(lap: number, topWidth: number | undefined): void {
    if (lap === this.lap) return;
    this.lap = lap;
    this.lapTopWidth = topWidth;
    const space = this.sceneries.get(SPACE_ZONE_INDEX);
    if (!space || lap === 0) return;
    // Normally baked a lap ahead; a jump (a debug start) bakes here.
    ZONE_ART.space.bakeLap?.(this.scene, lap);
    space.setLap(lap, topWidth);
    this.prepareNext(SPACE_ZONE_INDEX);
  }

  /**
   * How much of the weather of the given kind is visible right now: the summed fade alpha of the
   * live zones that show weather that way (`WEATHER.zoneView`), 0..1; 0 while the results still stands. Weather particles scale their
   * alpha by it, so they fade smoothly across a zone change.
   */
  weatherShare(view: 'full' | 'window'): number {
    // The results screen shows a still picture: nothing falls or moves on it any more.
    if (this.still) return 0;
    return weatherShareOf(view, this.sceneries.keys(), zoneIdOf, this.alphaOf, WEATHER.zoneView);
  }

  /** The creature of the current zone that may leave for the tower; `null` when it has none. */
  guestSource(): GuestSource | null {
    return this.sceneries.get(this.fade.current)?.guest ?? null;
  }

  /** Call when the logical screen size changes. */
  resize(width: number, height: number): void {
    this.ctx.width = width;
    this.ctx.height = height;
    this.ctx.clearBand = travellerClearBand(height);
    for (const scenery of this.sceneries.values()) scenery.resize(width, height);
    // The still has the old size; the zones draw again and lay out for the new one.
    this.unfreeze();
  }

  /** Call every frame with the camera scroll. */
  update(scrollY: number): void {
    this.scrollY = scrollY;
    this.ctx.towerLayers = towerLayersAt(scrollY, this.trayTopY, surfaceScreenY(this.ctx.height));
    this.ctx.wallDown = wallDownAt(scrollY, trayScrollY(this.trayTopY, this.ctx.height));
    if (this.still) return;
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

  /**
   * Replaces the zones by one still picture of what they show now. The results screen darkens the
   * backdrop, so it pays no more for the layers that nobody can see move. Stays until the scene ends
   * or the screen is resized.
   */
  freeze(): void {
    if (this.still) return;
    const { width, height } = this.ctx;
    const zones = [...this.sceneries.values()]
      .filter((scenery) => scenery.root.visible)
      .sort((a, b) => a.root.depth - b.root.depth);
    const first = zones[0];
    if (!first) return;
    const textures = this.scene.textures;
    if (textures.exists(BD_TEX.still)) textures.remove(BD_TEX.still);
    const picture = textures.addDynamicTexture(BD_TEX.still, width, height);
    if (!picture) return;
    picture.draw(
      zones.map((scenery) => scenery.root),
      0,
      0,
    );
    picture.render();
    this.still = this.scene.add
      .image(0, 0, BD_TEX.still)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(first.root.depth)
      .setDisplaySize(width, height);
    markPerfPart(this.still, 'bg');
    for (const scenery of zones) scenery.root.setVisible(false);
    this.frozen = zones;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.release());
  }

  /** The still goes (the screen size changed, or the scene ends); the zones it replaced show again. */
  private unfreeze(): void {
    if (!this.still) return;
    this.still.destroy();
    this.still = null;
    this.scene.textures.remove(BD_TEX.still);
    for (const scenery of this.frozen) scenery.root.setVisible(true);
    this.frozen = [];
  }

  /** The scene ends: its still picture is not kept. */
  private release(): void {
    this.still = null;
    this.frozen = [];
    if (this.scene.textures.exists(BD_TEX.still)) this.scene.textures.remove(BD_TEX.still);
  }

  private ensure(index: number): void {
    if (this.sceneries.has(index)) return;
    const id = zoneIdOf(index);
    this.bake(id, this.lap);
    const depth = DEPTH.background + BACKDROP.depthBase + index * BACKDROP.depthStep;
    const scenery = new ZoneScenery(
      this.scene,
      id,
      depth,
      this.artOf(id).build(this.scene, {
        ...this.sceneryLook(Math.max(this.lap, 1)),
        topWidth: this.lapTopWidth,
      }),
      this.ctx.width,
      this.ctx.height,
      this.look.weather,
    );
    scenery.setAlpha(this.fade.alphaOf(index));
    scenery.update(this.ctx, this.scrollY);
    this.sceneries.set(index, scenery);
  }

  private bake(id: ZoneId, lap: number): void {
    bakeSharedArt(this.scene);
    bakeFarArt(this.scene, id, this.look.weather);
    const art = this.artOf(id);
    if (!art.ownSky?.(this.look.weather)) bakeSky(this.scene, id, this.look.weather);
    const look = this.sceneryLook(Math.max(lap, 1));
    art.bake(this.scene, look);
    art.bakeLap?.(this.scene, look.lap);
  }

  private sceneryLook(lap: number): SceneryLook {
    return { lap, weather: this.look.weather, place: this.look.place };
  }

  /** Zone 1 is the art of the start place of the run; the others are fixed. */
  private artOf(id: ZoneId): ZoneArt {
    return id === 'kitchen' ? PLACE_ART[this.look.place] : ZONE_ART[id];
  }

  /**
   * Queues the pictures of the next zone (in Space: of the next lap's planet) a little after this
   * one starts, so the change itself is cheap; the queue is worked off one texture per frame, so
   * no frame hitches.
   */
  private prepareNext(index: number): void {
    this.scene.time.delayedCall(BACKDROP.prepareDelayMs, () => {
      const next = ZONES[index + 1];
      this.bakeQueue = collectBakeSteps(() => {
        if (next) this.bake(next.id, 1);
        else ZONE_ART.space.bakeLap?.(this.scene, this.lap + 1);
      });
    });
  }
}
