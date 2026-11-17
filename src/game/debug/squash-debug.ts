import * as Phaser from 'phaser';
import type { TowerSim } from '../../core/tower-sim';
import type { EffectLevel } from '../../data/effect-levels';
import type { SquashKind } from '../../data/topper-squash';
import { effectsMode } from '../effects-mode';
import type { TopperWorld } from '../objects/layer-topper';
import { lookCode, lookOfCode, plainLooks } from '../objects/plain-look';
import { plainToppers, topperSize } from '../objects/topper-look';
import type { TowerView } from '../objects/tower-view';

/** How the next layer lands on the decoration: on its whole body, or on its edge only. */
export type SquashMode = 'hit' | 'edge' | 'none';

/** Frames to wait after the decoration is put on the top layer, so the view shows it before the layer lands. */
const SETTLE_FRAMES = 3;
/** The edge shot: the new layer's edge ends this share of a topper's half body beyond its middle. */
const EDGE_OVERLAP = 0.45;
/** The cream demo lands this far off the middle, so it is no perfect landing and the two ends of the seam differ. */
const CREAM_OFFSET = 70;
/** ...and at most this share of the narrower of the two layers. */
const OFFSET_SHARE = 0.25;

interface Armed {
  kind: SquashKind;
  mode: SquashMode;
  frames: number;
}

/** The dev hook `window.tippySquash`. */
export type SquashHook = (kind: SquashKind, mode?: SquashMode) => boolean;

type SquashWindow = Window & {
  tippySquash?: SquashHook;
  tippySquashLevel?: (level: EffectLevel | null) => void;
};

/**
 * Dev tool: `window.tippySquash('strawberry', 'hit')` puts a decoration of that kind on the top
 * layer (the cream swirl for `'cream'`) and, once the layer in the air is flying, makes it land
 * on it right away, on its whole body (`hit`) or on its edge (`edge`). True when the top layer
 * could take it (false when the run is over or the top layer is not plain).
 */
export function installSquashDebug(scene: Phaser.Scene, sim: TowerSim, tower: TowerView): void {
  let armed: Armed | null = null;
  const world: TopperWorld = { kind: 'cherry', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

  const arm = (kind: SquashKind, mode: SquashMode = 'hit'): boolean => {
    const layers = sim.state.layers;
    const number = layers.length;
    const top = layers[number - 1];
    if (sim.state.phase === 'over' || !top || top.kind !== 'plain') return false;
    const pair = lookOfCode(plainLooks.codeFor(number)).pair;
    if (kind === 'cream') {
      plainToppers.force(number, null);
      plainLooks.force(number, lookCode({ pair, decor: 'cream', pattern: null }));
    } else {
      plainLooks.force(number, lookCode({ pair, decor: null, pattern: null }));
      plainToppers.force(number, mode === 'none' ? null : { kind, side: 1 });
    }
    armed = { kind, mode, frames: 0 };
    return true;
  };

  const step = (): void => {
    const job = armed;
    const flying = sim.state.flying;
    if (!job || !flying || sim.state.phase !== 'flying') return;
    job.frames += 1;
    if (job.frames < SETTLE_FRAMES) return;
    const topView = tower.topView();
    if (!topView) return;
    if (job.kind === 'cream' || job.mode === 'none') {
      const top = sim.state.layers[sim.state.layers.length - 1];
      // Never so far off that a narrow tower makes the layer miss and nothing lands.
      // A plain landing ("none") is dead centre, so repeated shots do not whittle the tower down to the
      // game-over width; the cream shot keeps its offset so the two ends of the seam differ.
      const offset =
        job.kind === 'cream'
          ? Math.min(CREAM_OFFSET, OFFSET_SHARE * Math.min(top?.width ?? 0, flying.width))
          : 0;
      flying.x = (top?.x ?? flying.x) + offset;
    } else {
      if (!topView.topperWorld(world)) {
        armed = null;
        console.warn('[squash] the top layer shows no topper (too narrow?)');
        return;
      }
      const top = sim.state.layers[sim.state.layers.length - 1];
      const local = world.x - topView.x;
      const topperX = (top?.x ?? world.x) + local;
      if (job.mode === 'hit') {
        flying.x = topperX;
      } else {
        const outward = local < 0 ? -1 : 1;
        const edge = topperX + outward * topperSize(job.kind).halfBody * EDGE_OVERLAP;
        flying.x = edge - (outward * flying.width) / 2;
      }
    }
    armed = null;
    sim.drop();
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  const win = window as SquashWindow;
  win.tippySquash = arm;
  win.tippySquashLevel = (level) => effectsMode.pinLevel(level);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    if (win.tippySquash === arm) delete win.tippySquash;
    delete win.tippySquashLevel;
  });
}
