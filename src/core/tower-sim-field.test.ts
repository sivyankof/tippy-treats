import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { TimingBot } from './bot';
import { FIELD_BOUNDS } from './field';
import { Rng } from './rng';
import { config, mutable, STEP } from './sim-test-utils';
import type { RunConfig } from './tower-sim';
import { TowerSim } from './tower-sim';

const LAYERS = 200;
const MAX_STEPS = 600_000;

/** Every placed layer is inside the field. */
function expectInside(sim: TowerSim, label: string): void {
  for (const layer of sim.state.layers) {
    expect(layer.x - layer.width / 2, `${label} left`).toBeGreaterThanOrEqual(
      FIELD_BOUNDS.left - 1e-6,
    );
    expect(layer.x + layer.width / 2, `${label} right`).toBeLessThanOrEqual(
      FIELD_BOUNDS.right + 1e-6,
    );
    expect(layer.width).toBeLessThanOrEqual(BALANCE.layer.maxWidth);
  }
}

/** Plays a bot run (continues taken) and checks the field after every step. */
function playChecked(base: Partial<RunConfig>, bot: TimingBot): number {
  const sim = new TowerSim(config(base));
  for (let i = 0; i < MAX_STEPS && sim.state.phase !== 'over' && sim.state.height < LAYERS; i++) {
    const events = sim.update(STEP);
    if (sim.state.phase === 'await_continue') events.push(...sim.continueRun());
    bot.observe(events);
    if (events.length > 0) expectInside(sim, `step ${i}`);
    if (bot.shouldDrop(sim)) sim.drop();
  }
  return sim.state.height;
}

describe('TowerSim: layers stay inside the field', () => {
  const teams: Array<[string, RunConfig['team']]> = [
    ['no team', [null, null, null]],
    ['puff', [{ id: 'puff', level: 5 }, { id: 'brownie', level: 3 }, null]],
    [
      'honey',
      [
        { id: 'honey', level: 3 },
        { id: 'puff', level: 3 },
        { id: 'jelly', level: 3 },
      ],
    ],
  ];
  for (const [name, team] of teams) {
    for (const seed of [1, 2, 3]) {
      it(`bot run of ${LAYERS} layers, ${name}, seed ${seed}`, () => {
        const bot = new TimingBot(12, new Rng(seed * 101));
        const height = playChecked({ seed, team }, bot);
        expect(height).toBeGreaterThan(30);
      });
    }
  }

  it('a perfect streak at the right edge grows to the left', () => {
    const sim = new TowerSim(config());
    const state = mutable(sim);
    state.layers[0] = { x: 880, width: 300, kind: 'plain', quality: 'perfect' };
    state.combo = 5;
    const bot = new TimingBot(0, new Rng(1));
    for (let i = 0; i < 20_000 && sim.state.layers.length < 8; i++) {
      bot.observe(sim.update(STEP));
      if (bot.shouldDrop(sim)) sim.drop();
    }
    expectInside(sim, 'streak');
    expect(sim.state.layers.length).toBeGreaterThanOrEqual(8);
  });
});
