import { describe, expect, it } from 'vitest';
import { BALANCE, DIFFICULTY } from '../data/balance';
import { TimingBot } from './bot';
import { Rng } from './rng';
import { mutable } from './sim-test-utils';
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
