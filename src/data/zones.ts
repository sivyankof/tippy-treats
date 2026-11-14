import { BALANCE } from './balance';

/** Rule a single layer follows. Zones 2-5 each have one; in Space every layer draws one. */
export type LayerRuleKind = 'none' | 'showcase' | 'roof' | 'clouds' | 'stars';

/** `random`: Space, each layer gets one of `SPACE_RULE_POOL`. */
export type ZoneRuleKind = LayerRuleKind | 'random';

export type ZoneId = 'kitchen' | 'showcase' | 'roof' | 'clouds' | 'stars' | 'space';

export interface ZoneDef {
  id: ZoneId;
  /** Multiplies the nominal layer speed (before the cap and the ability multiplier). */
  speedMult: number;
  /** Multiplies the score of a landing layer of this zone. */
  scoreMult: number;
  rule: ZoneRuleKind;
  /** Upper bound of the nominal speed (base speed times the zone multiplier); `null` for none. */
  speedCap: number | null;
}

/** Zone table of docs/02-gameplay.md, section 8. Zone `i` starts at layer `i * BALANCE.zones.length + 1`. */
export const ZONES: readonly ZoneDef[] = [
  { id: 'kitchen', speedMult: 1, scoreMult: 1, rule: 'none', speedCap: null },
  { id: 'showcase', speedMult: 1, scoreMult: 1.2, rule: 'showcase', speedCap: null },
  { id: 'roof', speedMult: 1.05, scoreMult: 1.5, rule: 'roof', speedCap: null },
  { id: 'clouds', speedMult: 1.05, scoreMult: 1.8, rule: 'clouds', speedCap: null },
  { id: 'stars', speedMult: 1.1, scoreMult: 2.2, rule: 'stars', speedCap: null },
  { id: 'space', speedMult: 1.15, scoreMult: 2.5, rule: 'random', speedCap: BALANCE.speed.max },
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
  },
  /** Roof: speed is `edge` at the walls and `centre` in the middle of the track (sine profile). */
  roof: {
    edgeMult: 0.8,
    centreMult: 1.2,
  },
  /** Clouds: per pass of the layer across the screen. */
  clouds: {
    chance: 0.5,
    coverMs: [300, 500],
    /** Where in the pass (share of the track from where the pass started) the cloud arrives. */
    startProgress: [0.15, 0.6],
    /** Space: a cloud on the first pass is guaranteed. */
    spaceFirstPassChance: 1,
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
