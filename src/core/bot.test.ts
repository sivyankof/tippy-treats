import { describe, expect, it } from 'vitest';
import { BALANCE, DIFFICULTY } from '../data/balance';
import { TimingBot } from './bot';
import { Rng } from './rng';
import { mutable } from './sim-test-utils';
import type { FlyingLayer } from './sim-types';
import { TowerSim, type RunConfig, type SimEvent } from './tower-sim';

const STEP = BALANCE.sim.stepMs;
const MAX_STEPS = 200_000;

const config = (): RunConfig => ({
  seed: 777,
  mode: 'classic',
  team: [null, null, null],
  tutorial: false,
});

/** Rng whose normal draws are fixed, and which counts them. */
class FixedRng extends Rng {
  draws = 0;
  constructor(private readonly z: number) {
    super(1);
  }
  override normal(): number {
    this.draws++;
    return this.z;
  }
}

/** Plays until the run ends or `maxLayers` landed; returns the sim and the drop count. */
function play(bot: TimingBot, maxLayers: number, maxSteps = MAX_STEPS) {
  const sim = new TowerSim(config());
  let drops = 0;
  for (let i = 0; i < maxSteps && sim.state.phase !== 'over'; i++) {
    const events = sim.update(STEP);
    if (sim.state.phase === 'await_continue') events.push(...sim.decline());
    bot.observe(events);
    if (sim.state.height >= maxLayers) break;
    if (bot.shouldDrop(sim)) {
      sim.drop();
      drops++;
    }
  }
  return { sim, drops };
}

/** Distance (towards the flying direction) from the target at the first tap of the first layer. */
function firstTapOffset(errorMs: number, guides = false): { offset: number; speed: number } {
  const sim = new TowerSim(config());
  if (guides) {
    mutable(sim).effects.push({
      id: 'ghost',
      layersLeft: 4,
      level: 1,
      boosted: false,
      value: 0,
    });
  }
  const bot = new TimingBot(1, new FixedRng(errorMs));
  for (let i = 0; i < MAX_STEPS; i++) {
    bot.observe(sim.update(STEP));
    const flying = sim.state.flying;
    if (flying && bot.shouldDrop(sim)) {
      return { offset: (flying.x - sim.topLayerX()) * flying.dir, speed: flying.speed };
    }
  }
  throw new Error('bot never tapped');
}

describe('TimingBot', () => {
  it('lands perfects for many layers with zero timing error', () => {
    const { sim } = play(new TimingBot(0, new Rng(1)), 40);
    expect(sim.state.height).toBeGreaterThanOrEqual(40);
    expect(sim.state.layers.filter((l) => l.quality === 'perfect').length).toBeGreaterThanOrEqual(
      35,
    );
  });

  it('is deterministic for the same seeds', () => {
    const a = play(new TimingBot(40, new Rng(5)), 60).sim;
    const b = play(new TimingBot(40, new Rng(5)), 60).sim;
    expect(a.state.height).toBe(b.state.height);
    expect(a.state.score).toBe(b.state.score);
  });

  it('gives different runs for different bot seeds when the error is not zero', () => {
    const scores = [1, 2, 3, 4, 5]
      .map((seed) => play(new TimingBot(60, new Rng(seed)), 60).sim)
      .map((sim) => `${sim.state.height}:${sim.state.score}`);
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('taps before the target for an early error and after it for a late one', () => {
    const early = firstTapOffset(-100);
    const late = firstTapOffset(100);
    const tolerance = (early.speed * STEP) / 1000 + 1e-6;
    expect(Math.abs(early.offset + (100 * early.speed) / 1000)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(late.offset - (100 * late.speed) / 1000)).toBeLessThanOrEqual(tolerance);
  });

  it('shrinks the timing error while the ghost guides are active', () => {
    const plain = firstTapOffset(100);
    const guided = firstTapOffset(100, true);
    const tolerance = (plain.speed * STEP) / 1000 + 1e-6;
    expect(Math.abs(plain.offset - (100 * plain.speed) / 1000)).toBeLessThanOrEqual(tolerance);
    const expected = (100 * DIFFICULTY.guidesSdMult * guided.speed) / 1000;
    expect(Math.abs(guided.offset - expected)).toBeLessThanOrEqual(tolerance);
  });

  it('rolls exactly one error per spawn event and ignores other events', () => {
    const rng = new FixedRng(0);
    const bot = new TimingBot(10, rng);
    const other: SimEvent = { type: 'miss', shielded: false };
    bot.observe([other, { type: 'combo', value: 1, widened: 0 }]);
    expect(rng.draws).toBe(0);
    const sim = new TowerSim(config());
    const spawn = sim.update(STEP).find((e) => e.type === 'spawn');
    expect(spawn).toBeDefined();
    bot.observe([other, spawn!, other]);
    expect(rng.draws).toBe(1);
  });

  it('still taps when the late error is longer than the way to the wall', () => {
    const { drops, sim } = play(new TimingBot(1, new FixedRng(800)), 5, 3000);
    expect(drops).toBeGreaterThanOrEqual(1);
    expect(sim.state.height > 0 || sim.state.phase === 'over').toBe(true);
  });

  it('never drops outside the flying phase', () => {
    const sim = new TowerSim(config());
    const bot = new TimingBot(0, new Rng(1));
    expect(bot.shouldDrop(sim)).toBe(false);
    sim.update(STEP);
    expect(sim.state.phase).toBe('flying');
    sim.drop();
    expect(sim.state.phase).toBe('falling');
    expect(bot.shouldDrop(sim)).toBe(false);
  });
});

/** A fresh sim with its first layer in the air; `setup` may move that layer around. */
function flyingSim(setup: (layer: FlyingLayer) => void): TowerSim {
  const sim = new TowerSim(config());
  sim.update(STEP);
  const flying = mutable(sim).flying;
  if (!flying) throw new Error('no flying layer');
  setup(flying);
  return sim;
}

/** Bot that has seen the spawn of the first layer, with the given timing error in ms (sd 1). */
function botFor(sim: TowerSim, errorMs: number, sdMs = 1): TimingBot {
  const bot = new TimingBot(sdMs, new FixedRng(errorMs / sdMs));
  bot.observe([{ type: 'spawn', layer: { ...(sim.state.flying as FlyingLayer) } }]);
  return bot;
}

describe('TimingBot with zone rules', () => {
  const TARGET = BALANCE.tray.centerX;

  it('uses the instantaneous speed of the roof profile for the estimate', () => {
    const place = (layer: FlyingLayer): void => {
      layer.rule = 'roof';
      layer.speed = 1000;
      layer.x = TARGET - 100;
      layer.dir = 1;
    };
    // 100 px before the target at the roof speed there (about 1185 px/s) is 84 ms away.
    expect(botFor(flyingSim(place), -90).shouldDrop(flyingSim(place))).toBe(true);
    const plain = (layer: FlyingLayer): void => {
      place(layer);
      layer.rule = 'none';
    };
    // At the plain 1000 px/s it is 100 ms away: too early for a tap 90 ms before the target.
    expect(botFor(flyingSim(plain), -90).shouldDrop(flyingSim(plain))).toBe(false);
  });

  it('never taps while the layer holds still, whatever the error', () => {
    for (const hold of ['windupMs', 'stopMs'] as const) {
      const sim = flyingSim((layer) => {
        layer.x = TARGET + 50;
        layer.dir = 1;
        layer[hold] = 200;
      });
      for (const error of [-500, 0, 500]) {
        expect(botFor(sim, error).shouldDrop(sim)).toBe(false);
      }
    }
  });

  it('does not take a fake-out reversal for a bounce after passing the target', () => {
    const sim = flyingSim((layer) => {
      layer.x = TARGET - 100;
      layer.dir = 1;
    });
    const layer = mutable(sim).flying as FlyingLayer;
    // Late error: the bot waits 200 ms after the target.
    const bot = botFor(sim, 200);
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.x = TARGET + 50;
    expect(bot.shouldDrop(sim)).toBe(false);
    // The layer stops, reverses and heads back towards the target.
    layer.stopMs = 100;
    bot.observe([{ type: 'fakeout', x: layer.x, stopMs: 100 }]);
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.stopMs = 0;
    layer.dir = -1;
    expect(bot.shouldDrop(sim)).toBe(false);
    expect(bot.shouldDrop(sim)).toBe(false);
  });

  it('does not tap at a fake-out point before the target, nor at the wall after the reversal', () => {
    const sim = flyingSim((layer) => {
      layer.x = TARGET - 200;
      layer.dir = 1;
    });
    const layer = mutable(sim).flying as FlyingLayer;
    // Zero error: the bot would tap exactly at the target.
    const bot = botFor(sim, 0);
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.x = TARGET - 100;
    expect(bot.shouldDrop(sim)).toBe(false);
    // The fake-out stops the layer short of the target and turns it away from it.
    layer.stopMs = 100;
    bot.observe([{ type: 'fakeout', x: layer.x, stopMs: 100 }]);
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.stopMs = 0;
    layer.dir = -1;
    // Heading away from the target: no tap, however far it flies.
    for (const x of [TARGET - 100, TARGET - 150, TARGET - 300]) {
      layer.x = x;
      expect(bot.shouldDrop(sim)).toBe(false);
    }
    // The wall bounce is not a "bounce after passing the target".
    layer.dir = 1;
    layer.x = TARGET - 350;
    expect(bot.shouldDrop(sim)).toBe(false);
    // Now it approaches the target as usual and taps once it is there.
    layer.x = TARGET - 50;
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.x = TARGET + 5;
    expect(bot.shouldDrop(sim)).toBe(true);
  });

  it('still takes a real wall bounce after the target was passed for a bounce', () => {
    const sim = flyingSim((layer) => {
      layer.x = TARGET - 50;
      layer.dir = 1;
    });
    const layer = mutable(sim).flying as FlyingLayer;
    const bot = botFor(sim, 5000);
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.x = TARGET + 50;
    expect(bot.shouldDrop(sim)).toBe(false);
    layer.dir = -1;
    expect(bot.shouldDrop(sim)).toBe(true);
  });

  it('scales the timing error by cloudSdMult while a cloud covers the layer', () => {
    // 120 ms past the target with a late error of 100 ms: a tap, unless the error grows to 150 ms.
    const speed = 1000;
    const pastTarget = (ms: number): number => TARGET + (ms * speed) / 1000;
    const approach = (cover: number): { sim: TowerSim; bot: TimingBot } => {
      const sim = flyingSim((layer) => {
        layer.speed = speed;
        layer.dir = 1;
        layer.x = TARGET - 50;
        layer.coverMs = cover;
      });
      const bot = botFor(sim, 100, 100);
      expect(bot.shouldDrop(sim)).toBe(false);
      mutable(sim).flying!.x = pastTarget(120);
      return { sim, bot };
    };
    const clear = approach(0);
    expect(clear.bot.shouldDrop(clear.sim)).toBe(true);
    const covered = approach(300);
    expect(covered.bot.shouldDrop(covered.sim)).toBe(false);
    mutable(covered.sim).flying!.x = pastTarget(160);
    expect(DIFFICULTY.cloudSdMult).toBe(1.5);
    expect(covered.bot.shouldDrop(covered.sim)).toBe(true);
  });
});

describe('TimingBot over the zones', () => {
  it('plays through all zones with a small error and keeps landing layers', () => {
    const sim = new TowerSim({ ...config(), startHeight: 15 });
    const bot = new TimingBot(15, new Rng(4));
    let drops = 0;
    for (let i = 0; i < 400_000 && sim.state.phase !== 'over' && sim.state.height < 110; i++) {
      const events = sim.update(STEP);
      if (sim.state.phase === 'await_continue') events.push(...sim.decline());
      bot.observe(events);
      if (bot.shouldDrop(sim)) {
        sim.drop();
        drops++;
      }
    }
    expect(drops).toBeGreaterThan(40);
    expect(sim.state.height).toBeGreaterThan(30);
  });
});
