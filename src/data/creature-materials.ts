import { ANIM } from './anim';
import type { CreatureId, CreaturePalette } from './creatures';
import { SPRINKLE_COLORS } from './creature-looks';

/** Small shared effect pictures a material burst can use (`FX_TEXTURES` in the game). */
export type MaterialTexture = 'drop' | 'circle' | 'star' | 'crumb' | 'spark';

/** A particle burst of a material: the fields of `ParticleStyle` (`game/fx/particle-motion.ts`). */
export interface MaterialBurst {
  /** Out of both side edges of the layer, or up from its top surface. */
  from: 'edges' | 'top';
  count: number;
  texture: MaterialTexture;
  /** Colours of the creature palette, or hex colours of their own. */
  colors: readonly (keyof CreaturePalette | `#${string}`)[];
  style: {
    speed: readonly [number, number];
    gravity: number;
    drag: number;
    spin: readonly [number, number];
    scale: readonly [number, number];
    scaleTo: number;
    alpha: number;
    holdShare: number;
    lifeMs: readonly [number, number];
    spreadDeg: number;
    tiltDeg: number;
    alignToDirection?: boolean;
  };
}

/**
 * A shape oscillation around the bottom edge. `x` and `y` are scale amplitudes; in `squash`
 * mode the layer gets wider as it gets lower (and back), in `breathe` mode both grow together.
 */
export interface MaterialWave {
  mode: 'squash' | 'breathe';
  x: number;
  y: number;
  periodMs: number;
}

/**
 * How a creature layer's material behaves (docs/06, section 3, "Материал"). It changes only the
 * shape of the layer (squash, tremble, tilt around its centre) and adds particles: the centre of
 * the layer stays where the simulation puts it. With "fewer effects" only `land` stays.
 */
export interface CreatureMaterial {
  /** Landing and the squash wave: depth of the squash, its length and the way it settles. */
  land: { squash: number; durationMul: number; ease: string };
  /** The shape follows the tower sway: amplitudes at full wobble; `tilt` multiplies the sway rotation. */
  sway?: MaterialWave & { tilt: number };
  /** Quiet motion at rest; with `burst` it runs `onMs` once every `everyMs` (a shiver). */
  idle?: MaterialWave & { burst?: { onMs: number; everyMs: number } };
  /** A short tremble right after its own landing that dies out over `ms`. */
  landShiver?: MaterialWave & { ms: number };
  /** Particles of its own landing. */
  landBurst?: MaterialBurst;
  /** Particles shed while the wobble is at least `fromWobble`, one burst per layer every `everyMs`. */
  shed?: { fromWobble: number; everyMs: number; burst: MaterialBurst };
  /** A gloss band runs over the layer when it lands, and once every `glossEveryMs` at rest. */
  glossOnLand?: boolean;
  glossEveryMs?: number;
  /** A heavy layer pushes the camera and the squash wave harder (multipliers). */
  impact?: { kick: number; wave: number };
  /** When the squash wave passes, the top shell lags: it lifts `liftPx` and settles back. */
  shellLag?: { liftPx: number; liftMs: number };
}

const DEFAULT_EASE = ANIM.land.ease;

/** Drops that run off the edges and fall. */
const DRIP = {
  speed: [20, 70],
  gravity: 900,
  drag: 0.6,
  spin: [0, 0],
  scale: [0.6, 1],
  scaleTo: 0.8,
  alpha: 1,
  holdShare: 0.6,
  lifeMs: [500, 750],
  spreadDeg: 30,
  tiltDeg: -60,
} as const;

/** Light puffs that float up and fade. */
const POWDER = {
  speed: [30, 80],
  gravity: -40,
  drag: 2,
  spin: [-60, 60],
  scale: [0.5, 0.9],
  scaleTo: 1.8,
  alpha: 0.7,
  holdShare: 0.2,
  lifeMs: [500, 800],
  spreadDeg: 80,
  tiltDeg: 20,
} as const;

/** Crumbs that fall off the edges. */
const CRUMBS = {
  speed: [80, 200],
  gravity: 1600,
  drag: 0.5,
  spin: [-360, 360],
  scale: [0.5, 0.9],
  scaleTo: 0.6,
  alpha: 1,
  holdShare: 0.6,
  lifeMs: [450, 700],
  spreadDeg: 50,
  tiltDeg: 25,
} as const;

export const CREATURE_MATERIALS: Readonly<Record<CreatureId, CreatureMaterial>> = {
  honey: {
    land: { squash: 1.1, durationMul: 1.5, ease: 'Sine.easeOut' },
    landBurst: { from: 'edges', count: 4, texture: 'drop', colors: ['glaze', 'body'], style: DRIP },
  },
  puff: {
    land: { squash: 1.3, durationMul: 1.8, ease: 'Cubic.easeOut' },
    idle: { mode: 'breathe', x: 0.012, y: 0.02, periodMs: 2600 },
  },
  jelly: {
    land: { squash: 1.45, durationMul: 2, ease: DEFAULT_EASE },
    sway: { mode: 'squash', x: 0.012, y: 0.06, periodMs: 700, tilt: 1.3 },
    idle: { mode: 'squash', x: 0.004, y: 0.012, periodMs: 1100 },
  },
  caramel: {
    land: { squash: 0.35, durationMul: 0.5, ease: 'Quad.easeOut' },
    glossOnLand: true,
  },
  frosty: {
    land: { squash: 0.5, durationMul: 0.6, ease: 'Quad.easeOut' },
    idle: {
      mode: 'squash',
      x: 0.004,
      y: 0.008,
      periodMs: 70,
      burst: { onMs: 320, everyMs: 4200 },
    },
    landShiver: { mode: 'squash', x: 0.008, y: 0.016, periodMs: 70, ms: 360 },
    landBurst: {
      from: 'top',
      count: 8,
      texture: 'star',
      colors: ['accent', 'sponge'],
      style: {
        speed: [120, 260],
        gravity: 300,
        drag: 2.4,
        spin: [-300, 300],
        scale: [0.4, 0.8],
        scaleTo: 0.2,
        alpha: 1,
        holdShare: 0.4,
        lifeMs: [400, 600],
        spreadDeg: 140,
        tiltDeg: 0,
      },
    },
  },
  brownie: {
    land: { squash: 0.5, durationMul: 0.8, ease: DEFAULT_EASE },
    impact: { kick: 2, wave: 1.5 },
  },
  sprinkle: {
    land: { squash: 1, durationMul: 1, ease: DEFAULT_EASE },
    landBurst: {
      from: 'top',
      count: 10,
      texture: 'spark',
      colors: SPRINKLE_COLORS,
      style: {
        speed: [200, 380],
        gravity: 1500,
        drag: 0.4,
        spin: [-540, 540],
        scale: [0.35, 0.5],
        scaleTo: 1,
        alpha: 1,
        holdShare: 0.7,
        lifeMs: [450, 650],
        spreadDeg: 110,
        tiltDeg: 0,
      },
    },
  },
  crumb: {
    land: { squash: 0.9, durationMul: 0.9, ease: DEFAULT_EASE },
    landBurst: {
      from: 'edges',
      count: 8,
      texture: 'crumb',
      colors: ['body', 'detail', 'accent'],
      style: CRUMBS,
    },
    shed: {
      fromWobble: ANIM.wobble.dangerFrom,
      everyMs: 650,
      burst: {
        from: 'edges',
        count: 2,
        texture: 'crumb',
        colors: ['body', 'detail'],
        style: CRUMBS,
      },
    },
  },
  ghost: {
    land: { squash: 0.6, durationMul: 1.4, ease: 'Sine.easeOut' },
    landBurst: {
      from: 'edges',
      count: 6,
      texture: 'circle',
      colors: ['body', 'glaze'],
      style: POWDER,
    },
    shed: {
      fromWobble: ANIM.wobble.dangerFrom,
      everyMs: 750,
      burst: { from: 'edges', count: 2, texture: 'circle', colors: ['body'], style: POWDER },
    },
  },
  twins: {
    land: { squash: 1, durationMul: 1, ease: DEFAULT_EASE },
    shellLag: { liftPx: 10, liftMs: 90 },
  },
  lemon: {
    land: { squash: 1.1, durationMul: 0.55, ease: 'Back.easeOut' },
    landShiver: { mode: 'squash', x: 0.012, y: 0.02, periodMs: 60, ms: 300 },
  },
  rainbow: {
    land: { squash: 1, durationMul: 1, ease: DEFAULT_EASE },
    glossOnLand: true,
    glossEveryMs: 4500,
  },
};

/** The material of a creature layer. */
export function creatureMaterial(id: CreatureId): CreatureMaterial {
  return CREATURE_MATERIALS[id];
}
