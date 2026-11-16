/** Rule a single layer follows. Zones 2-5 each have one; in Space every layer draws one. */
export type LayerRuleKind = 'none' | 'showcase' | 'roof' | 'clouds' | 'stars';

/** `random`: Space, each layer gets one of `SPACE_RULE_POOL`. */
export type ZoneRuleKind = LayerRuleKind | 'random';

export type ZoneId = 'kitchen' | 'showcase' | 'roof' | 'clouds' | 'stars' | 'space';

/** Zones have no speed multipliers: one speed curve for the whole tower (core/speed-curve.ts). */
export interface ZoneDef {
  id: ZoneId;
  /** Multiplies the score of a landing layer of this zone. */
  scoreMult: number;
  rule: ZoneRuleKind;
}

/** Zone table of docs/02-gameplay.md, section 8. Zone `i` starts at layer `i * BALANCE.zones.length + 1`. */
export const ZONES: readonly ZoneDef[] = [
  { id: 'kitchen', scoreMult: 1, rule: 'none' },
  { id: 'showcase', scoreMult: 1.2, rule: 'showcase' },
  { id: 'roof', scoreMult: 1.5, rule: 'roof' },
  { id: 'clouds', scoreMult: 1.8, rule: 'clouds' },
  { id: 'stars', scoreMult: 2.2, rule: 'stars' },
  { id: 'space', scoreMult: 2.5, rule: 'random' },
];

/** Index of the zone whose rule is `showcase` (the rush schedule lives in it). */
export const SHOWCASE_ZONE_INDEX = ZONES.findIndex((zone) => zone.rule === 'showcase');
export const SPACE_ZONE_INDEX = ZONES.findIndex((zone) => zone.rule === 'random');

/** The rules a Space layer draws from, one of them per layer. */
export const SPACE_RULE_POOL: readonly Exclude<LayerRuleKind, 'none'>[] = [
  'showcase',
  'roof',
  'clouds',
  'stars',
];

/** Numbers of the zone rules; `[min, max]` pairs are rolled uniformly. */
export const ZONE_RULES = {
  /** Showcase: every layer spawns on a random side. */
  showcase: {
    leftChance: 0.5,
  },
  /** Showcase "rush": a layer that waits and then flies faster. */
  rush: {
    /** Layers between two rushes, `[min, max]` (the first one counts from the zone start). */
    gap: [4, 6],
    /** The rush layer holds still this long after spawning (outlined in red by the scene). */
    windupMs: 300,
    /** Speed of the rush layer after the wind-up, times its nominal speed. */
    speedMult: 1.35,
    /**
     * Space only: a rush layer flies no faster than this, px/s, unless its nominal speed is
     * already higher (then the rush adds nothing). Showcase rushes are not capped.
     */
    spaceMaxSpeed: 1500,
  },
  /** Roof: speed is `edge` at the walls and `centre` in the middle of the track (sine profile). */
  roof: {
    edgeMult: 0.8,
    centreMult: 1,
  },
  /** Clouds: per pass of the layer across the screen. */
  clouds: {
    chance: 0.35,
    coverMs: [200, 350],
    /** Where in the pass (share of the track from where the pass started) the cloud arrives. */
    startProgress: [0.05, 0.3],
    /** Space: a cloud on the first pass is guaranteed. */
    spaceFirstPassChance: 1,
  },
  /**
   * Space laps (docs/02-gameplay.md, section 8): a lap is one zone length of Space layers (101-120
   * is lap 1). From lap 2 on the widest a layer may be shrinks by `step` of the full width per lap,
   * down to `floor`: `max(floor, 1 - step * (lap - 1)) * BALANCE.layer.maxWidth`.
   */
  spaceLaps: {
    step: 0.06,
    floor: 0.6,
  },
  /**
   * Space "second rule" (docs/02-gameplay.md, section 8): from lap `fromLap` a layer follows TWO
   * rules of the pool instead of one. A pair of `excludedPairs` is never drawn (either order).
   */
  spaceDouble: {
    fromLap: 4,
    excludedPairs: [['clouds', 'stars']] as readonly (readonly [LayerRuleKind, LayerRuleKind])[],
  },
  /**
   * Score bonus of Space laps (docs/02-gameplay.md, section 4): from lap 2 on the Space score
   * multiplier grows by `perLap` per lap beyond the first, up to `maxBonus` in all. Only the score.
   */
  spaceScore: {
    perLap: 0.1,
    maxBonus: 1,
  },
  /** Stars "fake-out": once in the life of a layer it stops, then reverses. */
  stars: {
    chance: 0.3,
    stopMs: 150,
    /** Where on the track (share from the left end) the stop point is rolled. */
    pointRange: [0.2, 0.8],
    /** Space: the rule always fires. */
    spaceChance: 1,
  },
} as const;

/**
 * Berries for reaching a Space lap for the first time (docs/05-economy-monetization.md): `berries`
 * for each lap from `fromLap` to `toLap` that a Classic run reaches, once per lap for the whole save.
 */
export const LAP_REWARD = { berries: 3, fromLap: 2, toLap: 10 } as const;
