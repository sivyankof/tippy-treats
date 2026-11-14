import { BALANCE } from '../data/balance';
import {
  SHOWCASE_ZONE_INDEX,
  SPACE_RULE_POOL,
  SPACE_ZONE_INDEX,
  ZONE_RULES,
  ZONES,
  type LayerRuleKind,
  type ZoneDef,
} from '../data/zones';
import { layerSpeed } from './drop';
import type { Rng } from './rng';

/**
 * The zone schedule is a pure function of the seed, the layer index and (for clouds) the pass
 * number. Every roll comes from its own stream, `zonesRng.fork('layer:<index>')` and its
 * children, so it does not depend on how the player plays: a retried layer, a skipped index
 * (twins) or the number of earlier rolls change nothing. `zonesRng` is `new Rng(seed).fork('zones')`.
 */

const LAST_ZONE = ZONES.length - 1;

/** Zone of a 1-based layer index. */
export function zoneIndexOf(index: number): number {
  return Math.min(LAST_ZONE, Math.max(0, Math.floor((index - 1) / BALANCE.zones.length)));
}

export function zoneOf(index: number): ZoneDef {
  return ZONES[zoneIndexOf(index)] as ZoneDef;
}

/** First layer index of a zone. */
export function zoneStartIndex(zoneIndex: number): number {
  return zoneIndex * BALANCE.zones.length + 1;
}

/**
 * Nominal speed of a layer above a tower of `height`: base speed times the zone multiplier,
 * capped where the zone has a cap (Space), then times the ability multiplier. The rush
 * multiplier and the roof profile come on top of this number (see core/flight.ts), so the
 * speed of a layer may exceed the cap through abilities and rush.
 */
export function nominalSpeed(height: number, zoneIndex: number, abilitySpeedMult: number): number {
  const zone = ZONES[zoneIndex] as ZoneDef;
  const zoned = layerSpeed(height, 1) * zone.speedMult;
  return Math.min(zone.speedCap ?? Infinity, zoned) * abilitySpeedMult;
}

/** What the zone rules decided for one layer. */
export interface LayerRules {
  index: number;
  zoneIndex: number;
  /** The rule of this layer; for Space the rule drawn from the pool. */
  rule: LayerRuleKind;
  /** The layer spawns at the left end of the track. */
  fromLeft: boolean;
  /** The layer waits, then flies faster (showcase only). */
  rush: boolean;
  /** Stars: x where the layer stops and reverses, `null` when this layer does not fake out. */
  fakeoutX: number | null;
}

/** One cloud: it covers the layer for `coverMs` once the pass reaches `startProgress`. */
export interface CloudRoll {
  coverMs: number;
  /** Share (0..1) of the track the layer has covered in this pass when the cloud arrives. */
  startProgress: number;
}

const layerStream = (zonesRng: Rng, index: number): Rng => zonesRng.fork(`layer:${index}`);

/**
 * Layer indices of the showcase zone that are rush layers. The first one comes `gap` layers
 * after the layer before the zone, the next ones `gap` layers after the previous; only
 * indices inside the zone count.
 */
export function rushIndices(zonesRng: Rng): number[] {
  const rng = zonesRng.fork('rush');
  const [min, max] = ZONE_RULES.rush.gap;
  const start = zoneStartIndex(SHOWCASE_ZONE_INDEX);
  const end = start + BALANCE.zones.length - 1;
  const result: number[] = [];
  for (let index = start - 1 + rng.int(min, max); index <= end; index += rng.int(min, max)) {
    result.push(index);
  }
  return result;
}

function ruleOf(zoneIndex: number, stream: Rng): LayerRuleKind {
  const rule = (ZONES[zoneIndex] as ZoneDef).rule;
  if (rule !== 'random') return rule;
  return SPACE_RULE_POOL[stream.fork('rule').int(0, SPACE_RULE_POOL.length - 1)] ?? 'none';
}

function fakeoutPoint(zoneIndex: number, stream: Rng): number | null {
  const rng = stream.fork('fakeout');
  const { chance, spaceChance, pointRange } = ZONE_RULES.stars;
  if (!rng.chance(zoneIndex === SPACE_ZONE_INDEX ? spaceChance : chance)) return null;
  const { minCenterX, maxCenterX } = BALANCE.layer;
  return minCenterX + (maxCenterX - minCenterX) * rng.range(pointRange[0], pointRange[1]);
}

/** Rules of the layer with this 1-based index. */
export function layerRules(zonesRng: Rng, index: number): LayerRules {
  const zoneIndex = zoneIndexOf(index);
  const stream = layerStream(zonesRng, index);
  const rule = ruleOf(zoneIndex, stream);
  const showcase = rule === 'showcase';
  // Parity of the index outside the showcase rule: odd layers start on the left.
  const fromLeft = showcase
    ? stream.fork('side').chance(ZONE_RULES.showcase.leftChance)
    : index % 2 === 1;
  const rush =
    showcase && (zoneIndex === SPACE_ZONE_INDEX || rushIndices(zonesRng).includes(index));
  return {
    index,
    zoneIndex,
    rule,
    fromLeft,
    rush,
    fakeoutX: rule === 'stars' ? fakeoutPoint(zoneIndex, stream) : null,
  };
}

/** The cloud of one pass (1-based) of a layer, or `null` when no cloud comes in this pass. */
export function cloudRoll(zonesRng: Rng, rules: LayerRules, pass: number): CloudRoll | null {
  if (rules.rule !== 'clouds') return null;
  const { chance, spaceFirstPassChance, coverMs, startProgress } = ZONE_RULES.clouds;
  const rng = layerStream(zonesRng, rules.index).fork(`cloud:${pass}`);
  const guaranteed = rules.zoneIndex === SPACE_ZONE_INDEX && pass === 1;
  // Always draw, so the cover time does not depend on the outcome of the chance roll.
  const roll = rng.next();
  const cover = rng.range(coverMs[0], coverMs[1]);
  const start = rng.range(startProgress[0], startProgress[1]);
  if (roll >= (guaranteed ? spaceFirstPassChance : chance)) return null;
  return { coverMs: cover, startProgress: start };
}
