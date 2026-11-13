import { ABILITY_ANIM } from '../../../data/ability-anim';
import { PALETTE } from '../../../data/palette';
import { effectsMode } from '../../effects-mode';
import { DEPTH } from '../../depth';
import { FX_TEXTURES } from '../fx-textures';
import { easeFn } from '../ease';
import { makeSpec } from './sprite-motion';
import type { SpriteFx } from './sprite-fx';

const cfg = ABILITY_ANIM.clouds;
const riseEase = easeFn(cfg.riseEase);

/** Shape of a group of soft clouds drifting up from a point. */
export interface CloudOptions {
  count: number;
  /** Scale range of the soft circle (the picture is 256 px). */
  scale: readonly [number, number];
  rise: number;
  lifeMs: number;
  colors: readonly number[];
  /** The clouds start spread over this width around `x`. */
  width: number;
}

/** Soft clouds that swell, drift up and fade; "fewer effects" keeps half of them. */
export function spawnClouds(sprites: SpriteFx, x: number, y: number, o: CloudOptions): void {
  const count = effectsMode.particleCount(o.count);
  for (let i = 0; i < count; i++) {
    const side = count === 1 ? 0 : i / (count - 1) - 0.5;
    const grown = o.scale[0] + (o.scale[1] - o.scale[0]) * ((i * cfg.sizeStep) % 1);
    sprites.spawn(
      makeSpec({
        texture: FX_TEXTURES.halo,
        tint: o.colors[i % o.colors.length] ?? PALETTE.textLight,
        depth: DEPTH.particles,
        x0: x + side * o.width,
        y0: y,
        y1: y - o.rise,
        move: riseEase,
        scaleX0: grown * cfg.startScale,
        scaleX1: grown,
        alpha0: cfg.startAlpha,
        alpha1: 0,
        delayMs: i * cfg.staggerMs,
        lifeMs: o.lifeMs,
      }),
    );
  }
}
