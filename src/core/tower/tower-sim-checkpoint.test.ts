import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { CHECKPOINT_HEIGHTS } from '../../data/zones/checkpoints';
import { checkpointStartWidth } from '../zones/checkpoints';
import { heightBonusCoins } from '../economy/coins';
import { STEP, config, mutable, only, pick, untilFlying, untilSettled } from './sim-test-utils';
import type { FlyingLayer, SimEvent, TeamSlot } from './sim-types';
import { TowerSim, prebuiltTower } from './tower-sim';
import { zoneIndexOf } from '../zones/zones';

const SEED = 777;

const fromCheckpoint = (height: number, team: Array<TeamSlot | null> = [null, null, null]) =>
  new TowerSim(
    config({
      seed: SEED,
      team,
      startHeight: height,
      startWidth: checkpointStartWidth(height as (typeof CHECKPOINT_HEIGHTS)[number]),
    }),
  );

/** Puts the next layer exactly over the tower top: a perfect landing. */
function perfect(sim: TowerSim): SimEvent[] {
  const events = untilFlying(sim);
  const flying = mutable(sim).flying;
  if (flying) flying.x = sim.topLayerX();
  sim.drop();
  events.push(...untilSettled(sim));
  return events;
}

/** Layer indices that got a floating coin: `coin_spawn` comes right before the spawn of its layer. */
function coinLayers(events: SimEvent[]): number[] {
  const out: number[] = [];
  let coin = false;
  for (const e of events) {
    if (e.type === 'coin_spawn') coin = true;
    if (e.type === 'spawn') {
      if (coin) out.push(e.layer.index);
      coin = false;
    }
  }
  return out;
}

function playTo(sim: TowerSim, height: number): SimEvent[] {
  const events: SimEvent[] = [];
  while (sim.state.height < height) events.push(...perfect(sim));
  return events;
}

/** What a spawn decides independently of the way the run was played. */
const scheduleOf = (layer: FlyingLayer) => ({
  index: layer.index,
  kind: layer.kind,
  creature: layer.creature,
  zoneIndex: layer.zoneIndex,
  rule: layer.rule,
  rush: layer.rush,
  dir: layer.dir,
  x: layer.x,
});

describe('TowerSim: start from a checkpoint', () => {
  it.each(CHECKPOINT_HEIGHTS)('starts at %i with the table width, no wobble and that zone', (h) => {
    const sim = fromCheckpoint(h);
    expect(sim.state.height).toBe(h);
    expect(sim.state.layers).toHaveLength(h);
    expect(sim.state.wobble).toBe(0);
    expect(sim.state.zoneIndex).toBe(zoneIndexOf(h + 1));
    expect(sim.state.score).toBe(0);
    expect(sim.state.coins).toBe(0);
    expect(sim.state.berries).toBe(0);
    expect(sim.state.combo).toBe(0);
    expect(sim.state.shield).toBe(0);
    expect(sim.state.effects).toEqual([]);
    expect(sim.state.layers.at(-1)?.width).toBe(checkpointStartWidth(h));

    const events = sim.update(STEP);
    // No zone plate: the run is already in its zone.
    expect(pick(events, 'zone_change')).toEqual([]);
    const layer = only(events, 'spawn').layer;
    expect(layer.index).toBe(h + 1);
    expect(layer.width).toBe(checkpointStartWidth(h));
    expect(layer.zoneIndex).toBe(zoneIndexOf(h + 1));
  });

  it('builds the tower below narrowing evenly from the first width to the start width', () => {
    const tower = prebuiltTower(40, 440);
    expect(tower[0]?.width).toBe(BALANCE.layer.firstWidth);
    expect(tower.at(-1)?.width).toBe(440);
    for (let i = 1; i < tower.length; i++) {
      expect(tower[i]?.width ?? 0).toBeLessThanOrEqual(tower[i - 1]?.width ?? 0);
    }
    expect(tower.every((l) => l.kind === 'plain' && l.x === BALANCE.tray.centerX)).toBe(true);
    // The debug start keeps full-width layers.
    expect(prebuiltTower(5).every((l) => l.width === BALANCE.layer.firstWidth)).toBe(true);
  });

  it.each(CHECKPOINT_HEIGHTS)(
    'from %i plays the same rules, coins and team slots as a run from zero with that seed',
    (h) => {
      const team: Array<TeamSlot | null> = [
        { id: 'honey', level: 1 },
        { id: 'jelly', level: 1 },
        { id: 'caramel', level: 1 },
      ];
      const zeroEvents = playTo(new TowerSim(config({ seed: SEED, team })), h + 12);
      const sim = fromCheckpoint(h, team);
      const events = playTo(sim, h + 12);
      const spawns = pick(events, 'spawn').map((e) => e.layer);
      const zeroSpawns = pick(zeroEvents, 'spawn')
        .map((e) => e.layer)
        .filter((l) => l.index > h);
      expect(spawns.map(scheduleOf)).toEqual(zeroSpawns.slice(0, spawns.length).map(scheduleOf));
      // The first creature is the first slot of the schedule above the start height.
      const firstCreature = spawns.find((l) => l.kind === 'creature');
      expect(firstCreature?.index).toBe(Math.ceil((h + 1) / 6) * 6);
      // Floating coins are rolled per layer index: the same layers above the checkpoint get one.
      const coinIndices = (all: SimEvent[]) => coinLayers(all).filter((i) => i > h && i <= h + 12);
      expect(coinIndices(events)).toEqual(coinIndices(zeroEvents));
    },
  );

  it('pays nothing for the skipped layers: score, coins, height bonus and berries come from placed layers', () => {
    const h = 40;
    const sim = fromCheckpoint(h);
    // Miss at once: nothing placed in this run.
    untilFlying(sim);
    const flying = mutable(sim).flying;
    if (flying) flying.x = 2000;
    sim.drop();
    const events = untilSettled(sim);
    events.push(...sim.decline());
    const over = pick(events, 'run_over')[0];
    expect(over?.result.height).toBe(h);
    expect(over?.result.score).toBe(0);
    expect(over?.result.coins).toBe(0);
    expect(over?.result.berries).toBe(0);
    expect(over?.result.perfects).toBe(0);
    expect(pick(events, 'coin_collect').filter((e) => e.source === 'height')).toEqual([]);
  });

  it('pays the height bonus for the layers climbed above the checkpoint only', () => {
    const h = 20;
    const sim = fromCheckpoint(h);
    playTo(sim, h + 20);
    const before = sim.state.coins;
    untilFlying(sim);
    const flying = mutable(sim).flying;
    if (flying) flying.x = 2000;
    sim.drop();
    const events = [...untilSettled(sim), ...sim.decline()];
    const bonus = pick(events, 'coin_collect').filter((e) => e.source === 'height');
    expect(bonus.map((e) => e.amount)).toEqual([heightBonusCoins(20)]);
    expect(sim.state.coins).toBe(before + heightBonusCoins(20));
    expect(sim.state.height).toBe(h + 20);
  });

  it('skips the golden layers below the start: the first golden one is the next on schedule', () => {
    const sim = fromCheckpoint(40);
    const events = playTo(sim, 52);
    const golden = pick(events, 'spawn')
      .map((e) => e.layer)
      .filter((l) => l.kind === 'golden');
    expect(golden.map((l) => l.index)).toEqual([50]);
    expect(sim.state.berries).toBe(BALANCE.golden.perfectBerries);
  });
});
