import * as Phaser from 'phaser';
import type { TowerSim } from '../../core/tower-sim';
import type { SquashKind } from '../../data/topper-squash';
import type { TopperWorld } from '../objects/layer-topper';
import { lookCode, lookOfCode, plainLooks } from '../objects/plain-look';
import { plainToppers, topperSize } from '../objects/topper-look';
import type { TowerView } from '../objects/tower-view';

/** How the next layer lands on the decoration: on its whole body, or on its edge only. */
export type SquashMode = 'hit' | 'edge';

/** Frames to wait after the decoration is put on the top layer, so the view shows it before the layer lands. */
const SETTLE_FRAMES = 3;
/** The edge shot: the new layer's edge ends this share of a topper's half body beyond its middle. */
const EDGE_OVERLAP = 0.45;
/** The cream demo lands this far off the middle, so it is no perfect landing and the two ends of the seam differ. */
const CREAM_OFFSET = 70;

interface Armed {
  kind: SquashKind;
  mode: SquashMode;
  frames: number;
}

type SquashWindow = Window & {
  tippySquash?: (kind: SquashKind, mode?: SquashMode) => boolean;
};

/**
 * Dev tool: `window.tippySquash('strawberry', 'hit')` puts a decoration of that kind on the top
 * layer (the cream swirl for `'cream'`) and, once the layer in the air is flying, makes it land
 * on it right away, on its whole body (`hit`) or on its edge (`edge`). True when the top layer
 * could take it.
 */
export function installSquashDebug(scene: Phaser.Scene, sim: TowerSim, tower: TowerView): void {
  let armed: Armed | null = null;
  const world: TopperWorld = { kind: 'cherry', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

  const arm = (kind: SquashKind, mode: SquashMode = 'hit'): boolean => {
    const layers = sim.state.layers;
    const number = layers.length;
    const top = layers[number - 1];
    if (!top || top.kind !== 'plain') return false;
    const pair = lookOfCode(plainLooks.codeFor(number)).pair;
    if (kind === 'cream') {
      plainToppers.force(number, null);
      plainLooks.force(number, lookCode({ pair, decor: 'cream', pattern: null }));
    } else {
      plainLooks.force(number, lookCode({ pair, decor: null, pattern: null }));
      plainToppers.force(number, { kind, side: 1 });
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
    if (job.kind === 'cream') {
      flying.x = (sim.state.layers[sim.state.layers.length - 1]?.x ?? flying.x) + CREAM_OFFSET;
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
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    if (win.tippySquash === arm) delete win.tippySquash;
  });
}
