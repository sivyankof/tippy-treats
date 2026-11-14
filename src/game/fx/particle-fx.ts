import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { PALETTE } from '../../data/palette';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { pickInt } from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { FX_TEXTURES } from './fx-textures';
import { confettiRain, edgeBurst, lineBurst, type ParticleStyle } from './particle-motion';
import type { Particles } from './particles';

const DUST_STYLE: ParticleStyle = {
  ...ANIM.dust.style,
  lifeMs: [ANIM.dust.lifeMs, ANIM.dust.lifeMs],
};
const DUST_TINTS = [PALETTE.panelShadow];
const SPARK_TINTS = [PALETTE.success, PALETTE.textLight];
/** Confetti colours, in turn. */
export const CONFETTI_TINTS = [
  PALETTE.accent,
  PALETTE.accentSecondary,
  PALETTE.gold,
  PALETTE.success,
  PALETTE.danger,
] as const;

/** Intention-level particle effects of a run; the numbers live in ANIM. */
export class ParticleFx {
  constructor(private readonly particles: Particles) {}

  /** Puffs of dust from under both edges of a layer of `width` landed at (x, bottomY). */
  dust(x: number, bottomY: number, width: number): void {
    const count = pickInt(ANIM.dust.perSide) * 2;
    this.particles.emit(count, (n) => edgeBurst(x, bottomY, width, n, DUST_STYLE), {
      texture: FX_TEXTURES.circle,
      tints: DUST_TINTS,
      depth: DEPTH.particles,
    });
  }

  /** Crumbs along the cut line at `cutX`, flying towards the bitten-off side (1 right, -1 left). */
  crumbs(cutX: number, centerY: number, side: 1 | -1, color: number): void {
    this.particles.emit(
      pickInt(ANIM.bite.crumbs),
      (n) => lineBurst(cutX, centerY, BALANCE.layer.height, side, n, ANIM.bite.crumbStyle),
      { texture: FX_TEXTURES.crumb, tints: [color], depth: DEPTH.particles },
    );
  }

  /**
   * Bits of the decorations of a bitten-off part: they fly out of the glaze band (`centerY`,
   * `height`) at the cut line towards the bitten-off side. None in "Fewer effects".
   */
  decorBits(cutX: number, centerY: number, height: number, side: 1 | -1, tints: number[]): void {
    if (effectsMode.reduced || tints.length === 0) return;
    this.particles.emit(
      pickInt(PLAIN_LAYER.decor.bits.count),
      (n) => lineBurst(cutX, centerY, height, side, n, ANIM.bite.crumbStyle),
      { texture: FX_TEXTURES.crumb, tints, depth: DEPTH.particles },
    );
  }

  /** A sneeze: crumbs fly out of both sides of the top layer. */
  sneezeCrumbs(centerX: number, centerY: number, width: number, color: number): void {
    this.particles.emit(
      pickInt(ANIM.sneeze.crumbs),
      (n) => edgeBurst(centerX, centerY, width, n, ANIM.sneeze.crumbStyle),
      { texture: FX_TEXTURES.crumb, tints: [color], depth: DEPTH.particles },
    );
  }

  /** Green and white sparks from the edges of a perfectly landed layer. */
  sparks(centerX: number, centerY: number, width: number): void {
    this.particles.emit(
      ANIM.perfect.sparks,
      (n) => edgeBurst(centerX, centerY, width, n, ANIM.perfect.sparkStyle),
      { texture: FX_TEXTURES.star, tints: SPARK_TINTS, depth: DEPTH.particles },
    );
  }

  /** Confetti over a screen of `width` x `height`, pinned to the screen. */
  confetti(width: number, height: number, depth: number = DEPTH.particles): void {
    const { count, spawnDepth, style } = ANIM.record.confetti;
    this.particles.emit(count, (n) => confettiRain(width, height, spawnDepth, n, style), {
      texture: FX_TEXTURES.confetti,
      tints: CONFETTI_TINTS,
      depth,
      scrollFactor: 0,
    });
  }
}
