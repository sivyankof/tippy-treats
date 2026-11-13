import type { SimEvent, TowerState } from '../../../core/tower-sim';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { DEPTH } from '../../depth';
import { effectsMode } from '../../effects-mode';
import { easeFn } from '../ease';
import { FX_TEXTURES } from '../fx-textures';
import { cakeColorsFor } from '../../objects/layer-art';
import type { FxKit } from './kit';
import { makeSpec } from './sprite-motion';

const cfg = ABILITY_ANIM.crumb;
const fly = easeFn(cfg.cutEase);

/** While a crumb is active, the crumbs of every cut fly to the crumb layer. */
export class CrumbFlight {
  constructor(private readonly kit: FxKit) {}

  fly(event: Extract<SimEvent, { type: 'land' }>, state: Readonly<TowerState>): void {
    const { tower, sprites } = this.kit;
    if (!event.cutSide) return;
    let target = -1;
    for (let i = state.layers.length - 2; i >= 0; i--) {
      if (state.layers[i]?.creature === 'crumb') {
        target = i;
        break;
      }
    }
    const eater = tower.layerPose(target);
    const index = state.layers.length - 1;
    const cut = tower.layerPose(index);
    if (!eater || !cut) return;
    const side = event.cutSide === 'right' ? 1 : -1;
    const color = cakeColorsFor(state.layers[index]?.creature ?? null, index + 1).cake;
    const count = effectsMode.particleCount(cfg.cutCrumbs);
    for (let i = 0; i < count; i++) {
      sprites.spawn(
        makeSpec({
          texture: FX_TEXTURES.crumb,
          tint: color,
          depth: DEPTH.particles,
          x0: cut.x + (side * cut.width) / 2,
          y0: cut.y,
          x1: eater.x,
          y1: eater.y,
          arc: cfg.cutArc,
          move: fly,
          scaleX0: cfg.scaleFrom,
          scaleX1: cfg.scaleTo,
          alpha1: cfg.cutEndAlpha,
          delayMs: i * cfg.cutStaggerMs,
          lifeMs: cfg.cutFlightMs,
        }),
      );
    }
    tower.viewAt(target)?.faceView.react('gape', cfg.cutGapeMs);
  }
}
