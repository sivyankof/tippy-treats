import * as Phaser from 'phaser';
import { BALANCE } from '../../data/tower/balance';
import { clampLevel, type CreatureId } from '../../data/creatures/creatures';
import {
  STORE_CLOCK,
  STORE_FEATURE,
  STORE_IAP_SHOT,
  STORE_SHOTS,
  type StoreFace,
  type StoreMoment,
  type StoreScreen,
  type StoreStage,
} from '../../data/debug/store-shots';
import type { SimEvent, TowerSim } from '../../core/tower/tower-sim';
import type { TowerState } from '../../core/tower/sim-types';
import { openScreen, SCENES, type SceneKey } from '../app/scene-keys';
import { addDynamicTexture } from '../app/dynamic-texture';
import { offList } from '../ui/common/bake-texture';
import { LayerView } from '../objects/tower/layer-view';
import { artHeight, artTopPad } from '../objects/tower/layer-art';
import type { DropDriver } from '../perf/perf-drivers';
import { readDebugParams } from '../../util/debug-params';
import { triggerLightning } from './debug-triggers';
import type { GameScene } from '../scenes/game-scene';

/**
 * Dev build only: `window.tippyStore`, the in-game half of `npm run store:shots`
 * (docs/11-release-store.md, section 5). The script stops the page clock and moves it frame by
 * frame; `begin(id)` sets up the shot of `data/debug/store-shots.ts`, and every game step this
 * director drops layers and watches for the moment. `status` turns `ready` on the step whose frame
 * is the shot. `creatureArt` draws a creature large on a transparent picture for the overlays.
 */
export interface TippyStore {
  begin(id: string): void;
  readonly status: string;
  creatureArt(spec: CreatureArtSpec): Promise<string>;
}

export interface CreatureArtSpec {
  creature: CreatureId;
  level: number;
  grown: boolean;
  face: StoreFace;
  /** Width of the picture in pixels. */
  widthPx: number;
}

/** Width of the layer the big creatures are drawn from: wide enough to look like a layer, narrow enough to keep the face large. */
const ART_LAYER_WIDTH = 280;
/** Frames the face of a big creature gets to take its expression. */
const ART_FACE_FRAMES = 12;
/** A perfect drop taps when the layer is this share of one frame's travel (or `PERFECT_MIN_PX`) from the tower centre. */
const PERFECT_FRAME_SHARE = 0.6;
const PERFECT_MIN_PX = 2;
/** An offset drop and the `flying` moment hit inside this window past their share of the layer width. */
const SHARE_WINDOW = 0.05;
/** How long the picture of a cloud stays near the layer after it has let it go, ms. */
const CLOUD_LINGER_MS = 900;
/** The sway is at its top when `sin(phase)` is at least this. */
const SWAY_TOP = 0.97;

/** `off` (a share of the layer width) lies in the window just past `share`. */
function inShareWindow(off: number, share: number): boolean {
  return off >= share && off <= share + SHARE_WINDOW;
}

type Sim = Pick<TowerSim, 'state' | 'topLayerX' | 'currentModifiers'>;

/** Taps for the shot and remembers what happened, while the director watches. */
class StageDriver implements DropDriver {
  landed = 0;
  /** Centre x of the top layer, as the sim saw it on the last step. */
  topX = 0;
  /** Length of the last game step. */
  frameMs = 16;
  /** Game time the flying layer was last under a cloud (the nebula of Space); none yet. */
  coveredAt = Number.NEGATIVE_INFINITY;
  /** Game time of the last ability of each creature. */
  readonly abilities = new Map<CreatureId, number>();
  timeMs = 0;

  constructor(private readonly stage: Extract<StoreStage, { kind: 'run' }>) {}

  get dropsDone(): boolean {
    return this.landed >= this.stage.driver.drops;
  }

  observe(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'land') this.landed += 1;
      if (event.type === 'ability') this.abilities.set(event.creature, this.timeMs);
    }
  }

  shouldDrop(sim: Sim): boolean {
    const { flying, phase } = sim.state;
    this.topX = sim.topLayerX();
    if (flying && flying.coverMs > 0) this.coveredAt = this.timeMs;
    if (this.dropsDone || phase !== 'flying' || !flying) return false;
    const dx = flying.x - this.topX;
    const driver = this.stage.driver;
    if (driver.kind === 'offset') {
      // Never a perfect landing: it would write its own words over the ability's.
      const perfect = Math.abs(dx) <= BALANCE.drop.perfectTolerance;
      return !perfect && inShareWindow(dx / flying.width, driver.share);
    }
    const frameTravel = (flying.speed * this.frameMs) / 1000;
    return Math.abs(dx) <= Math.max(PERFECT_MIN_PX, frameTravel * PERFECT_FRAME_SHARE);
  }
}

const SCREEN_KEYS: Readonly<Record<StoreScreen, SceneKey>> = {
  collection: SCENES.collection,
  daily: SCENES.daily,
  shop: SCENES.shop,
};

class StoreDirector implements TippyStore {
  status = 'idle';
  private stage: StoreStage | null = null;
  private driver: StageDriver | null = null;
  private scene: GameScene | null = null;
  private momentStart: number | null = null;
  private screenOpened: number | null = null;
  private timeMs = 0;
  private flashAt: number | null = null;
  private artCount = 0;

  constructor(private readonly game: Phaser.Game) {
    game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) =>
      this.step(delta),
    );
  }

  /** Starts the shot `id` from scratch (a second call forgets the first shot). */
  begin(id: string): void {
    const stage =
      id === 'iap'
        ? STORE_IAP_SHOT.stage
        : id === 'feature'
          ? STORE_FEATURE.background.stage
          : STORE_SHOTS.find((s) => s.id === id)?.stage;
    this.driver = null;
    this.scene = null;
    this.momentStart = null;
    this.screenOpened = null;
    this.timeMs = 0;
    this.flashAt = null;
    if (!stage) {
      this.stage = null;
      this.status = `failed: no shot ${id}`;
      return;
    }
    this.stage = stage;
    this.status = 'busy';
  }

  private step(delta: number): void {
    if (this.status !== 'busy' || !this.stage) return;
    this.timeMs += delta;
    try {
      if (this.stage.kind === 'screen') this.stepScreen(this.stage.screen, this.stage.settleMs);
      else this.stepRun(this.stage);
    } catch (error) {
      this.status = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private stepScreen(screen: StoreScreen, settleMs: number): void {
    const scenes = this.game.scene;
    if (this.screenOpened === null) {
      if (!scenes.isActive(SCENES.home)) return;
      openScreen(scenes.getScene(SCENES.home), SCREEN_KEYS[screen]);
      this.screenOpened = this.timeMs;
      return;
    }
    if (this.timeMs - this.screenOpened >= settleMs) this.status = 'ready';
  }

  private stepRun(stage: Extract<StoreStage, { kind: 'run' }>): void {
    const scenes = this.game.scene;
    if (!scenes.isActive(SCENES.game)) return;
    const scene = scenes.getScene(SCENES.game) as GameScene;
    const probe = scene.perfProbe();
    if (!probe) return;
    if (this.scene !== scene) {
      this.scene = scene;
      this.driver = new StageDriver(stage);
      scene.drivers.set(this.driver);
      if (stage.hideHud) scene.scene.setVisible(false, SCENES.hud);
    }
    const driver = this.driver;
    if (!driver) return;
    driver.timeMs = this.timeMs;
    driver.frameMs = this.game.loop.delta;
    if (probe.state.phase === 'over') throw new Error('the run ended before the moment');
    const waiting = !driver.dropsDone && stage.moment.kind !== 'ability';
    if (probe.introActive || waiting) return;
    if (this.momentStart === null) this.momentStart = this.timeMs;
    if (this.reached(stage.moment, probe.state, driver)) this.status = 'ready';
  }

  private reached(moment: StoreMoment, state: Readonly<TowerState>, driver: StageDriver): boolean {
    const since = this.timeMs - (this.momentStart ?? this.timeMs);
    switch (moment.kind) {
      case 'landed':
        return since >= moment.ms;
      case 'flying': {
        const { flying, phase } = state;
        if (since < moment.afterMs || phase !== 'flying' || !flying) return false;
        // In the open: no cloud (the nebula of Space) due in this pass, and the last one let a
        // layer go long enough ago for its picture to have drifted away.
        const clear = flying.cloudAheadPx < 0 && this.timeMs - driver.coveredAt >= CLOUD_LINGER_MS;
        return clear && inShareWindow((flying.x - driver.topX) / flying.width, moment.share);
      }
      case 'wobble':
        return state.wobble >= moment.atLeast && Math.sin(state.wobblePhase) >= SWAY_TOP;
      case 'ability': {
        const at = driver.abilities.get(moment.creature);
        return at !== undefined && this.timeMs - at >= moment.afterMs;
      }
      case 'lightning': {
        if (this.flashAt === null) {
          if (since < moment.waitMs) return false;
          if (readDebugParams().weather !== 'storm') throw new Error('the run is not a storm');
          if (!triggerLightning()) throw new Error('no lightning hook');
          this.flashAt = this.timeMs;
        }
        return this.timeMs - this.flashAt >= moment.afterMs;
      }
    }
  }

  async creatureArt(spec: CreatureArtSpec): Promise<string> {
    const host = this.game.scene.getScenes(true)[0];
    if (!host) throw new Error('creatureArt: no running scene');
    const stage = spec.grown ? 'grown' : 'base';
    const view = offList(new LayerView(host));
    this.artCount += 1;
    const key = `store_art_${String(this.artCount)}`;
    try {
      view
        .setStageMode(stage)
        .setLook({ kind: 'creature', creature: spec.creature, level: clampLevel(spec.level) })
        .setLayer(1, ART_LAYER_WIDTH, null)
        .setArtOpaque();
      if (spec.face !== 'none') view.faceView.react(spec.face, STORE_CLOCK.artFaceMs);
      for (let i = 0; i < ART_FACE_FRAMES; i++) view.tick(STORE_CLOCK.frameMs);
      const above = BALANCE.layer.height / 2 + artTopPad(spec.creature, stage);
      const scale = spec.widthPx / ART_LAYER_WIDTH;
      const height = Math.ceil(artHeight(spec.creature, stage) * scale);
      const texture = addDynamicTexture(host.textures, key, spec.widthPx, height);
      if (!texture) throw new Error('creatureArt: no texture');
      view.setScale(scale);
      texture.draw(view, spec.widthPx / 2, above * scale).render();
      return await new Promise<string>((resolve, reject) => {
        texture.snapshot((image) => {
          if (!(image instanceof HTMLImageElement)) {
            reject(new Error('creatureArt: no snapshot'));
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        });
      });
    } finally {
      view.destroy();
      if (host.textures.exists(key)) host.textures.remove(key);
    }
  }
}

/** Installs `window.tippyStore` (dev build only, from `main.ts`). */
export function registerStoreStage(game: Phaser.Game): void {
  (window as Window & { tippyStore?: TippyStore }).tippyStore = new StoreDirector(game);
}
