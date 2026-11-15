import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { TimingBot } from './bot';
import { Rng } from './rng';
import { config, STEP } from './sim-test-utils';
import { TowerSim, type RunConfig, type SimEvent } from './tower-sim';
import { nominalSpeed } from './zones';

const { afterPerfects, layers, speedMult, minGapLayers } = BALANCE.tempoEase;

/** A steady bot (tiny timing error) so that long perfect streaks happen. */
function playAll(overrides: Partial<RunConfig>, seed = 7): SimEvent[] {
  const sim = new TowerSim(config({ seed: 4242, ...overrides }));
  const bot = new TimingBot(8, new Rng(seed));
  const all: SimEvent[] = [];
  for (let i = 0; i < 400_000 && sim.state.phase !== 'over'; i++) {
    const events = sim.update(STEP);
    if (sim.state.phase === 'await_continue') events.push(...sim.decline());
    bot.observe(events);
    all.push(...events);
    if (bot.shouldDrop(sim)) sim.drop();
  }
  return all;
}

describe('tempo ease in the run', () => {
  it('slows the next layers after a perfect streak, at most once per gap', () => {
    const events = playAll({});
    const spawns = events.filter((e) => e.type === 'spawn');
    const eased: number[] = [];
    let combo = 0;
    const starts: number[] = [];
    let index = 0;
    for (const event of events) {
      if (event.type === 'spawn') {
        index = event.layer.index;
        const plain = nominalSpeed(index - 1, event.layer.zoneIndex, 1);
        if (Math.abs(event.layer.speed - plain * speedMult) < 1e-6) eased.push(index);
        else expect(event.layer.speed).toBeCloseTo(plain, 6);
      } else if (event.type === 'tempo_ease') {
        expect(combo).toBeGreaterThanOrEqual(afterPerfects);
        expect(event.layers).toBe(layers);
        starts.push(index);
      } else if (event.type === 'combo') combo = event.value;
      else if (event.type === 'land' && event.quality === 'normal') combo = 0;
    }
    expect(spawns.length).toBeGreaterThan(30);
    expect(starts.length).toBeGreaterThan(0);
    for (let i = 1; i < starts.length; i++) {
      expect((starts[i] ?? 0) - (starts[i - 1] ?? 0)).toBeGreaterThanOrEqual(minGapLayers);
    }
    // Every ease covers exactly its layers.
    expect(eased).toHaveLength(starts.length * layers);
    for (const start of starts) {
      expect(eased.slice(eased.indexOf(start), eased.indexOf(start) + layers)).toEqual(
        Array.from({ length: layers }, (_, k) => start + k),
      );
    }
  });

  it('is deterministic', () => {
    expect(playAll({})).toEqual(playAll({}));
  });

  it('has no ease in the tutorial run', () => {
    const events = playAll({ tutorial: true });
    expect(events.some((e) => e.type === 'tempo_ease')).toBe(false);
  });

  it('counts the eased layers down in the state as they land', () => {
    const sim = new TowerSim(config({ seed: 4242 }));
    const bot = new TimingBot(8, new Rng(7));
    const seen: number[] = [];
    for (let i = 0; i < 400_000 && sim.state.phase !== 'over'; i++) {
      const events = sim.update(STEP);
      if (sim.state.phase === 'await_continue') events.push(...sim.decline());
      bot.observe(events);
      if (events.some((e) => e.type === 'tempo_ease')) {
        seen.push(sim.state.tempoLeft);
        break;
      }
      if (bot.shouldDrop(sim)) sim.drop();
    }
    expect(seen).toEqual([layers]);
  });
});
