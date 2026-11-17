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
import { collectBakeSteps } from '../../ui/bake-texture';
import { surfaceScreenY, travellerClearBand } from '../../camera-layout';
import { bakeSharedArt } from './art-kit';
import { towerLayersAt } from './mountain-placement';
import { bakeFarArt } from './far-plane';
import { cloudsArt } from './clouds-zone';
import { Counter } from './worktop';
import { kitchenArt } from './kitchen-zone';
import type { GuestSource } from './guest-source';
import { newFrameCtx, type FrameCtx } from './life';
import { roofArt } from './roof-zone';
import { shopArt } from './shop-zone';
import { showcaseArt } from './showcase-zone';
import { spaceArt } from './space-zone';
import { starsArt } from './stars-zone';
import { ZoneFade } from './zone-fade';
import { weatherShareOf } from './weather-share';
import { PrepQueue, prepTarget, sameTarget, type PrepTarget } from './zone-prep';
import {
  bakeSky,
  ZoneScenery,
  type SceneryDef,
  type SceneryLook,
  type ZoneArt,
} from './zone-scenery';

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

/** What is being got ready for the coming change, and the zone built for it (hidden, not updated) once it is. */
interface Prep {
  target: PrepTarget;
  scenery: ZoneScenery | null;
}

/**
 * The scenery of a run: the backdrop of the current zone (sky, four parallax layers and
 * background life) and the counter under the tray. When the zone changes, the new
 * backdrop fades in over the old one; the run does not wait for it. The next zone is baked and
 * built ahead, in small steps, from `BACKDROP.prep.leadLayers` layers before the change, so the
 * change itself only shows it (docs/06, "Смена зоны").
 */
export class Backdrop {
  private readonly fade: ZoneFade;
  private readonly sceneries = new Map<number, ZoneScenery>();
  private readonly counter: Counter;
  private readonly ctx: FrameCtx;
  /** The steps that bake and build what the coming change shows, a few per frame. */
  private readonly prepQueue = new PrepQueue();
  private prep: Prep | null = null;
  private lastNowMs: number;
  private scrollY = 0;
  /** True once the first frame has set the start view of the zones built with the backdrop. */
  private started = false;
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
    this.ctx = newFrameCtx(width, height, travellerClearBand(height), scene.time.now);
    this.counter = new Counter(scene, trayTopY, width);
    this.ensure(state.zoneIndex);
  }

  /**
   * Follows the run: the zone it is in (a change starts the cross-fade into it) and, in Space, the
   * lap (the planet changes). One Space scenery serves every lap.
   */
  follow(state: RunBackdropState): void {
    this.setLap(flyingLap(state.height), state.layers.at(-1)?.width);
    this.setZone(state.zoneIndex);
    this.planAhead(state.height, state.zoneIndex);
  }

  private setZone(zoneIndex: number): void {
    if (zoneIndex === this.fade.current) return;
    this.ensure(zoneIndex);
    this.fade.goTo(zoneIndex);
  }

  private setLap(lap: number, topWidth: number | undefined): void {
    if (lap === this.lap) return;
    this.lap = lap;
    this.lapTopWidth = topWidth;
    const space = this.sceneries.get(SPACE_ZONE_INDEX);
    if (!space || lap === 0) return;
    // Normally baked ahead (`planAhead`); a jump (a debug start) bakes here.
    ZONE_ART.space.bakeLap?.(this.scene, lap, this.look.planetSeed, topWidth);
    space.setLap(lap, topWidth);
  }

  /**
   * Starts getting the coming change ready once the tower is `BACKDROP.prep.leadLayers` layers
   * below it: the next zone's pictures are baked and the zone is built, hidden; in Space the next
   * lap's planet is baked. What was got ready for another change is dropped.
   */
  private planAhead(height: number, zoneIndex: number): void {
    const target = prepTarget(height, zoneIndex, BACKDROP.prep.leadLayers);
    if (sameTarget(target, this.prep?.target ?? null)) return;
    this.dropPrep();
    if (!target) return;
    const prep: Prep = { target, scenery: null };
    this.prep = prep;
    if (target.kind === 'lap') {
      this.prepQueue.add(
        collectBakeSteps(() =>
          ZONE_ART.space.bakeLap?.(this.scene, target.lap, this.look.planetSeed, this.lapTopWidth),
        ),
      );
      return;
    }
    this.prepQueue.add(collectBakeSteps(() => this.bake(zoneIdOf(target.index), this.lap)));
    // Two steps: the zone's lives and pictures, then the container that holds them.
    let def: SceneryDef | null = null;
    this.prepQueue.add([
      () => (def = this.buildDef(target.index)),
      () => {
        if (def) prep.scenery = this.assemble(target.index, def);
      },
    ]);
  }

  /** The zone built ahead for this change, with the work still left done now; `null` when none was. */
  private takePrepared(index: number): ZoneScenery | null {
    const prep = this.prep;
    if (prep?.target.kind !== 'zone' || prep.target.index !== index) return null;
    this.prepQueue.flush();
    this.prep = null;
    return prep.scenery;
  }

  private dropPrep(): void {
    this.prepQueue.clear();
    this.prep?.scenery?.destroy();
    this.prep = null;
  }

  /**
   * How much of the weather of the given kind is visible right now: the summed visible part of the
   * live zones that show weather that way (`WEATHER.zoneView`; an old zone is covered by the one fading in), 0..1; 0 while the results still stands. Weather particles scale their
   * alpha by it, so they fade smoothly across a zone change.
   */
  weatherShare(view: 'full' | 'window'): number {
    // The results screen shows a still picture: nothing falls or moves on it any more.
    if (this.still) return 0;
    return weatherShareOf(
      view,
      this.sceneries.keys(),
      this.fade.current,
      zoneIdOf,
      this.alphaOf,
      WEATHER.zoneView,
    );
  }

  /** True while the backdrop cross-fades from one zone into the next. */
  get fading(): boolean {
    return this.fade.previous !== null;
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
    this.prep?.scenery?.resize(width, height);
    // The still has the old size; the zones draw again and lay out for the new one.
    this.unfreeze();
  }

  /** Call every frame with the camera scroll. */
  update(scrollY: number): void {
    if (!this.started) {
      // The first frame is the start view: the zones built by now stand on their spots here.
      this.started = true;
      for (const scenery of this.sceneries.values()) scenery.startAt(scrollY);
    }
    this.scrollY = scrollY;
    this.ctx.towerLayers = towerLayersAt(scrollY, this.trayTopY, surfaceScreenY(this.ctx.height));
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
    this.prepQueue.work(BACKDROP.prep.budgetMs, () => performance.now());
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

  /** Shows zone `index`: the one built ahead for it, or one built now (a debug start, a jump). */
  private ensure(index: number): void {
    if (this.sceneries.has(index)) return;
    const prepared = this.takePrepared(index);
    const scenery = prepared ?? this.buildScenery(index);
    // A zone shown later starts where the camera is now; those of the first frame are set by `update`.
    scenery.startAt(this.scrollY);
    // Built ahead, Space takes the tower top width of the moment its first lap begins.
    if (prepared) scenery.setLap(Math.max(this.lap, 1), this.lapTopWidth);
    scenery.setAlpha(this.fade.alphaOf(index));
    scenery.update(this.ctx, this.scrollY);
    this.sceneries.set(index, scenery);
  }

  /** Bakes what zone `index` still needs and builds it, hidden and not yet updated. */
  private buildScenery(index: number): ZoneScenery {
    return this.assemble(index, this.buildDef(index));
  }

  /** Bakes what zone `index` still needs and makes its lives, the first half of building it. */
  private buildDef(index: number): SceneryDef {
    const id = zoneIdOf(index);
    this.bake(id, this.lap);
    return this.artOf(id).build(this.scene, {
      ...this.sceneryLook(Math.max(this.lap, 1)),
      topWidth: this.lapTopWidth,
    });
  }

  /** The second half: the hidden scenery of zone `index` from its made lives. */
  private assemble(index: number, def: SceneryDef): ZoneScenery {
    const id = zoneIdOf(index);
    const depth = DEPTH.background + BACKDROP.depthBase + index * BACKDROP.depthStep;
    const scenery = new ZoneScenery(
      this.scene,
      id,
      depth,
      def,
      this.ctx.width,
      this.ctx.height,
      this.look.weather,
    );
    scenery.setAlpha(0);
    return scenery;
  }

  private bake(id: ZoneId, lap: number): void {
    bakeSharedArt(this.scene);
    bakeFarArt(this.scene, id, this.look.weather);
    const art = this.artOf(id);
    if (!art.ownSky?.(this.look.weather)) bakeSky(this.scene, id, this.look.weather);
    const look = this.sceneryLook(Math.max(lap, 1));
    art.bake(this.scene, look);
    art.bakeLap?.(this.scene, look.lap, look.planetSeed, this.lapTopWidth);
  }

  private sceneryLook(lap: number): SceneryLook {
    return {
      lap,
      weather: this.look.weather,
      place: this.look.place,
      planetSeed: this.look.planetSeed,
    };
  }

  /** Zone 1 is the art of the start place of the run; the others are fixed. */
  private artOf(id: ZoneId): ZoneArt {
    return id === 'kitchen' ? PLACE_ART[this.look.place] : ZONE_ART[id];
  }
}
