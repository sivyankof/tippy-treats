import { describe, expect, it } from 'vitest';
import { TimingBot } from './bot';
import { Rng } from '../common/rng';
import { config, STEP } from './sim-test-utils';
import { TowerSim, type RunConfig, type SimEvent, type SpeedScaleContext } from './tower-sim';

/** Plays a whole bot run and returns every event, so two runs can be compared exactly. */
function playAll(overrides: Partial<RunConfig>): SimEvent[] {
  const sim = new TowerSim(config({ seed: 4242, ...overrides }));
  const bot = new TimingBot(35, new Rng(9));
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

describe('RunConfig.speedScale (analysis hook)', () => {
  it('changes nothing when absent or when it returns 1', () => {
    const plain = playAll({});
    expect(plain.length).toBeGreaterThan(100);
    expect(playAll({ speedScale: () => 1 })).toEqual(plain);
  });

  it('scales the nominal speed of the spawning layer and sees its context', () => {
    const seen: SpeedScaleContext[] = [];
    const scaled = playAll({
      speedScale: (context) => {
        seen.push(context);
        return 0.5;
      },
    });
    const plain = playAll({});
    const speeds = (events: SimEvent[]): number[] =>
      events.flatMap((e) => (e.type === 'spawn' ? [e.layer.speed] : []));
    expect(speeds(scaled)[0]).toBeCloseTo((speeds(plain)[0] ?? 0) * 0.5, 9);
    expect(seen[0]).toEqual({ index: 1, height: 0, zoneIndex: 0, combo: 0 });
    // One call per spawn, with a growing index.
    expect(seen.map((c) => c.index).slice(0, 3)).toEqual([1, 2, 3]);
  });
});
