import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { ZONE_RULES } from '../data/zones';
import { Rng } from './rng';
import {
  STEP,
  config,
  mutable,
  only,
  pick,
  runUntil,
  untilFlying,
  untilSettled,
} from './sim-test-utils';
import type { FlyingLayer, SimEvent } from './sim-types';
import { TowerSim } from './tower-sim';
import { cloudRoll, layerRules, nominalSpeed, rushIndices } from './zones';

const zonesOf = (seed: number): Rng => new Rng(seed).fork('zones');
const newSim = (seed: number, startHeight: number): TowerSim =>
  new TowerSim(config({ seed, startHeight }));

/** Waits for the next layer, puts it exactly over the tower top and drops it: a perfect landing. */
function perfect(sim: TowerSim): SimEvent[] {
  const events = untilFlying(sim);
  const flying = mutable(sim).flying;
  if (flying) flying.x = sim.topLayerX();
  sim.drop();
  events.push(...untilSettled(sim));
  return events;
}

/** Plays perfect layers until the tower is `height` high; returns every event. */
function playTo(sim: TowerSim, height: number): SimEvent[] {
  const events: SimEvent[] = [];
  while (sim.state.height < height) events.push(...perfect(sim));
  return events;
}

const spawnOf = (events: SimEvent[]): FlyingLayer => only(events, 'spawn').layer;

describe('TowerSim: zones', () => {
  it('emits zone_change at the first layer of layers 21, 41, 61, 81 and 101, once each', () => {
    const sim = newSim(4242, 0);
    const events = playTo(sim, 105);
    const changes = pick(events, 'zone_change');
    expect(changes.map((e) => e.zoneIndex)).toEqual([1, 2, 3, 4, 5]);
    // The event comes with the spawn of layer 21, 41, ...: just before its spawn event.
    const spawns = pick(events, 'spawn');
    for (const zone of [1, 2, 3, 4, 5]) {
      const at = events.findIndex((e) => e.type === 'zone_change' && e.zoneIndex === zone);
      const next = events.slice(at).find((e) => e.type === 'spawn');
      expect(next && next.type === 'spawn' ? next.layer.index : 0).toBe(zone * 20 + 1);
    }
    expect(spawns.every((e) => e.layer.zoneIndex === Math.floor((e.layer.index - 1) / 20))).toBe(
      true,
    );
    expect(sim.state.zoneIndex).toBe(5);
  });

  it('starts a debug run straight in the zone of startHeight + 1, without a zone_change', () => {
    for (const [start, zone] of [
      [0, 0],
      [19, 0],
      [20, 1],
      [60, 3],
      [99, 4],
      [100, 5],
      [250, 5],
    ] as const) {
      const sim = newSim(9, start);
      expect(sim.state.zoneIndex).toBe(zone);
      const events = sim.update(STEP);
      expect(pick(events, 'zone_change')).toHaveLength(0);
      expect(spawnOf(events).zoneIndex).toBe(zone);
    }
  });

  it('does not repeat zone_change when the first layer of a zone is retried', () => {
    const sim = newSim(31, 19);
    playTo(sim, 20);
    expect(pick(untilFlying(sim), 'zone_change')).toHaveLength(1);
    mutable(sim).flying!.x = 3000;
    sim.drop();
    untilSettled(sim);
    expect(sim.state.phase).toBe('await_continue');
    const retry = sim.continueRun();
    expect(pick(retry, 'zone_change')).toHaveLength(0);
    expect(spawnOf(retry).index).toBe(21);
  });

  it('gives a retried layer the same rules, and the same rules in two runs of one seed', () => {
    const a = newSim(55, 40);
    const spawnA = spawnOf(untilFlying(a));
    mutable(a).flying!.x = 3000;
    a.drop();
    untilSettled(a);
    const retry = spawnOf(a.continueRun());
    const pickRules = (l: FlyingLayer) => ({
      index: l.index,
      rule: l.rule,
      rush: l.rush,
      dir: l.dir,
      x: l.x,
    });
    expect(pickRules(retry)).toEqual(pickRules(spawnA));
    const b = newSim(55, 40);
    expect(pickRules(spawnOf(untilFlying(b)))).toEqual(pickRules(spawnA));
  });

  it('plays the same schedule whatever the player does: rules depend on seed and index only', () => {
    const seed = 808;
    const sim = newSim(seed, 0);
    const events = playTo(sim, 60);
    for (const { layer } of pick(events, 'spawn')) {
      const rules = layerRules(zonesOf(seed), layer.index);
      expect(layer).toMatchObject({
        rule: rules.rule,
        rush: rules.rush,
        dir: rules.fromLeft ? 1 : -1,
      });
    }
  });

  it('follows the index, not the height, when twins skip layers', () => {
    const sim = newSim(8, 19);
    untilFlying(sim);
    mutable(sim).bonusHeight = 1;
    mutable(sim).height += 1;
    perfect(sim);
    // Height 21 after one landed layer: the next layer is number 22, in zone 2.
    const spawn = spawnOf(untilFlying(sim));
    expect(spawn.index).toBe(22);
    expect(spawn.zoneIndex).toBe(1);
  });
});

describe('TowerSim: zone speed and score', () => {
  it('gives the nominal speed of the zone, the cap in Space, abilities on top', () => {
    for (const [start, zone] of [
      [0, 0],
      [25, 1],
      [45, 2],
      [65, 3],
      [88, 4],
      [100, 5],
      [150, 5],
    ] as const) {
      const sim = newSim(3, start);
      expect(spawnOf(sim.update(STEP)).speed).toBeCloseTo(nominalSpeed(start, zone, 1));
    }
    expect(spawnOf(newSim(3, 150).update(STEP)).speed).toBe(BALANCE.speed.max);

    const lemon = newSim(3, 150);
    mutable(lemon).effects.push({
      id: 'frosty',
      layersLeft: 3,
      level: 1,
      boosted: false,
      value: 1.25,
    });
    expect(spawnOf(lemon.update(STEP)).speed).toBeCloseTo(BALANCE.speed.max * 1.25);
  });

  it('multiplies the score of the landing layer by the zone', () => {
    const expected: Array<[number, number]> = [
      [0, 30],
      [20, 36],
      [40, 45],
      [60, 54],
      [80, 66],
      [100, 75],
    ];
    for (const [start, score] of expected) {
      const sim = newSim(11, start);
      perfect(sim);
      expect(sim.state.score).toBe(score);
    }
  });

  it('multiplies zone and ability, and leaves the golden bonus flat', () => {
    const sim = newSim(11, 40);
    mutable(sim).effects.push({
      id: 'sprinkle',
      layersLeft: 5,
      level: 1,
      boosted: false,
      value: 2,
    });
    perfect(sim);
    expect(sim.state.score).toBe(Math.round(30 * 2 * 1.5));
    // Layer 100 is golden (25 divides it) and the last one of the stars zone (x2.2).
    const gold = newSim(11, 99);
    perfect(gold);
    expect(gold.state.score).toBe(66 + BALANCE.score.goldenPerfectBonus);
  });
});

describe('TowerSim: rules in flight', () => {
  /** A seed and layer index (>= `from`) where `pickRule` holds, searched through the schedule. */
  function find(
    from: number,
    to: number,
    pickRule: (rng: Rng, index: number) => boolean,
  ): { seed: number; index: number } {
    for (let seed = 1; seed < 500; seed++) {
      for (let index = from; index <= to; index++) {
        if (pickRule(zonesOf(seed), index)) return { seed, index };
      }
    }
    throw new Error('no such layer in 500 seeds');
  }

  it('holds a rush layer still for the wind-up, then flies it 1.35 times faster', () => {
    const { seed, index } = find(21, 40, (rng, i) => rushIndices(rng).includes(i));
    const sim = newSim(seed, index - 1);
    const spawn = spawnOf(sim.update(STEP));
    expect(spawn).toMatchObject({ rush: true, rule: 'showcase', windupMs: 300 });
    const startX = spawn.x;
    const layer = sim.state.flying!;
    for (let ms = 0; ms < 280; ms += STEP) sim.update(STEP);
    expect(layer.x).toBe(startX);
    expect(layer.windupMs).toBeGreaterThan(0);
    runUntil(sim, () => layer.windupMs === 0);
    const before = layer.x;
    for (let i = 0; i < 24; i++) sim.update(STEP);
    const expected = (layer.speed * ZONE_RULES.rush.speedMult * 24 * STEP) / 1000;
    expect(Math.abs(layer.x - before)).toBeCloseTo(expected, 0);
  });

  it('lets a tap during the wind-up drop the layer where it stands', () => {
    const { seed, index } = find(21, 40, (rng, i) => rushIndices(rng).includes(i));
    const sim = newSim(seed, index - 1);
    const spawn = spawnOf(sim.update(STEP));
    sim.drop();
    expect(sim.state.phase).toBe('falling');
    const land = only(untilSettled(sim), 'land');
    expect(land.dx).toBeCloseTo(spawn.x - BALANCE.tray.centerX);
  });

  it('reports a cloud and covers the layer while it lasts', () => {
    const { seed, index } = find(
      61,
      80,
      (rng, i) => cloudRoll(rng, layerRules(rng, i), 1) !== null,
    );
    const sim = newSim(seed, index - 1);
    sim.update(STEP);
    const events = runUntil(sim, () => (sim.state.flying?.coverMs ?? 0) > 0);
    const cloud = only(events, 'cloud');
    expect(cloud.pass).toBe(1);
    expect(cloud.coverMs).toBeGreaterThanOrEqual(ZONE_RULES.clouds.coverMs[0]);
    expect(cloud.coverMs).toBeLessThanOrEqual(ZONE_RULES.clouds.coverMs[1]);
    runUntil(sim, () => sim.state.flying?.coverMs === 0);
  });

  it('reports a fake-out, stops the layer for 150 ms and turns it round', () => {
    const { seed, index } = find(81, 100, (rng, i) => layerRules(rng, i).fakeoutX !== null);
    const sim = newSim(seed, index - 1);
    sim.update(STEP);
    const layer = sim.state.flying!;
    const dir = layer.dir;
    const events = runUntil(sim, () => layer.stopMs > 0);
    const fake = only(events, 'fakeout');
    expect(fake.stopMs).toBe(ZONE_RULES.stars.stopMs);
    expect(layer.x).toBe(fake.x);
    sim.update(STEP * 5);
    expect(layer.x).toBe(fake.x);
    runUntil(sim, () => layer.stopMs === 0);
    expect(layer.dir).toBe(-dir);
  });

  it('treats a retry of a fake-out layer as a new life: it fakes out again at the same point', () => {
    const { seed, index } = find(81, 100, (rng, i) => layerRules(rng, i).fakeoutX !== null);
    const sim = newSim(seed, index - 1);
    sim.update(STEP);
    const first = only(
      runUntil(sim, () => (sim.state.flying?.stopMs ?? 0) > 0),
      'fakeout',
    );
    mutable(sim).flying!.x = 3000;
    sim.drop();
    untilSettled(sim);
    expect(sim.state.phase).toBe('await_continue');
    const events = sim.continueRun();
    expect(spawnOf(events).index).toBe(index);
    events.push(...runUntil(sim, () => (sim.state.flying?.stopMs ?? 0) > 0));
    expect(only(events, 'fakeout').x).toBe(first.x);
  });

  it('puts every Space layer under exactly one rule that fires', () => {
    const seen = new Set<string>();
    for (let index = 101; index <= 160; index++) {
      const sim = newSim(2026, index - 1);
      const events = sim.update(STEP);
      for (let ms = 0; ms < 3000; ms += STEP) events.push(...sim.update(STEP));
      const layer = spawnOf(events);
      seen.add(layer.rule);
      expect(['showcase', 'roof', 'clouds', 'stars']).toContain(layer.rule);
      expect(layer.rush).toBe(layer.rule === 'showcase');
      expect(pick(events, 'fakeout')).toHaveLength(layer.rule === 'stars' ? 1 : 0);
      expect(pick(events, 'cloud').length > 0).toBe(layer.rule === 'clouds');
    }
    expect(seen.size).toBe(4);
  });
});

describe('TowerSim: floating coin roll per layer index', () => {
  it('rolls the coin of a layer from the seed and index, not from earlier layers', () => {
    let coins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const direct = pick(newSim(seed, 20).update(STEP), 'coin_spawn');
      const walked = newSim(seed, 15);
      playTo(walked, 20);
      // The tower stands centred in both runs, so even the x of the coin matches.
      expect(pick(untilFlying(walked), 'coin_spawn')).toEqual(direct);
      coins += direct.length;
    }
    expect(coins).toBeGreaterThan(5);
  });

  it('keeps the coin of a retried layer and rolls no new one', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sim = newSim(seed, 9);
      untilFlying(sim);
      mutable(sim).flying!.x = 3000;
      sim.drop();
      untilSettled(sim);
      expect(pick(sim.continueRun(), 'coin_spawn')).toHaveLength(0);
    }
  });
});
