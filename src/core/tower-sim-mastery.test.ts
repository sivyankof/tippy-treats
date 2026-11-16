import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import type { CreatureId } from '../data/creatures';
import { MASTERY } from '../data/mastery';
import { TimingBot } from './bot';
import { Rng } from './rng';
import {
  config,
  dropAt,
  mutable,
  only,
  pick,
  runUntil,
  sneezeDrop,
  untilFlying,
  untilSettled,
} from './sim-test-utils';
import { newLandingPreview, TowerSim, type SimEvent } from './tower-sim';

/** Five layers below the first creature layer (index 6), the creature at `level`. */
const crewAt = (level: number, id: CreatureId, startHeight = 5): TowerSim =>
  new TowerSim(config({ startHeight, team: [{ id, level }, null, null] }));

/** Waits for the next layer, removes its floating coin and drops it `offset` past the target. */
function drop(sim: TowerSim, offset = 0): SimEvent[] {
  const events = untilFlying(sim);
  mutable(sim).floatingCoinX = null;
  return [...events, ...dropAt(sim, offset)];
}

function missNow(sim: TowerSim): SimEvent[] {
  const events = untilFlying(sim);
  const state = mutable(sim);
  state.floatingCoinX = null;
  if (state.flying) state.flying.x = 2000;
  sim.drop();
  return [...events, ...untilSettled(sim)];
}

const masteryCoins = (events: SimEvent[]): number =>
  pick(events, 'coin_collect')
    .filter((e) => e.source === 'mastery')
    .reduce((sum, e) => sum + e.amount, 0);

describe('mastery in the run', () => {
  it('a run without creatures sends no mastery or perk events', () => {
    const sim = new TowerSim(config());
    const bot = new TimingBot(45, new Rng(3));
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 * 600 && sim.state.phase !== 'over'; i++) {
      const step = sim.update(BALANCE.sim.stepMs);
      if (sim.state.phase === 'await_continue') step.push(...sim.decline());
      bot.observe(step);
      events.push(...step);
      if (bot.shouldDrop(sim)) sim.drop();
    }
    expect(sim.state.phase).toBe('over');
    expect(events.filter((e) => e.type === 'mastery' || e.type === 'perk')).toEqual([]);
    expect(sim.state.shieldLevel).toBe(0);
  });

  it('the rainbow layer of level 3 is not cut itself, of level 2 it is', () => {
    for (const [level, cut] of [
      [2, true],
      [3, false],
    ] as const) {
      const sim = crewAt(level, 'rainbow');
      const events = drop(sim, 100);
      const landed = only(events, 'land');
      expect(landed.quality).toBe('normal');
      expect(landed.cutWidth > 0, `level ${level}`).toBe(cut);
      expect(landed.savedWidth > 0, `level ${level}`).toBe(!cut);
      expect(sim.state.combo).toBe(0);
      // The ability was not boosted: one protected layer, not two.
      expect(only(events, 'ability').boosted).toBe(false);
      expect(sim.state.effects.find((e) => e.id === 'rainbow')?.layersLeft).toBe(1);
    }
  });

  it('the landing preview of a protected rainbow layer matches the landing', () => {
    const sim = crewAt(3, 'rainbow');
    untilFlying(sim);
    expect(sim.flyingModifiers().protectCut).toBe(true);
    expect(sim.currentModifiers().protectCut).toBe(false);
    const passed = (): boolean => {
      const flying = sim.state.flying;
      return !!flying && (flying.x - sim.topLayerX()) * flying.dir >= 100;
    };
    runUntil(sim, () => !passed());
    runUntil(sim, passed);
    sim.drop();
    const preview = newLandingPreview();
    expect(sim.landingPreview(preview)).toBe(true);
    expect(preview).toMatchObject({ creature: 'rainbow', cut: null, pieceWidth: 0 });
    const events = untilSettled(sim);
    expect(only(events, 'land').cutWidth).toBe(0);
    expect(sim.state.layers.at(-1)?.width).toBe(preview.width);
  });

  it('pays the rainbow score for a protected layer from level 2', () => {
    const sim = crewAt(2, 'rainbow');
    drop(sim, 100);
    const before = sim.state.score;
    const events = drop(sim, 100);
    expect(only(events, 'perk')).toEqual({
      type: 'perk',
      creature: 'rainbow',
      perk: 'rainbow_protected_score',
      score: 50,
    });
    expect(sim.state.score - before).toBe(BALANCE.score.normal + 50);
  });

  it('frosty of level 5 leaves a Rime layer: normal speed, wider tolerance', () => {
    const sim = crewAt(5, 'frosty');
    drop(sim, 40);
    const frozen = [drop(sim, 40), drop(sim, 40), drop(sim, 40)].flat();
    expect(pick(frozen, 'mastery')).toEqual([
      { type: 'mastery', creature: 'frosty', coins: 0, score: 0 },
    ]);
    expect(pick(frozen, 'effect_end')).toEqual([]);
    expect(sim.state.effects).toMatchObject([{ id: 'frosty', layersLeft: 1, tail: true }]);
    expect(sim.currentModifiers().perfectTolerance).toBe(
      BALANCE.drop.perfectTolerance + MASTERY.frosty.toleranceAdd,
    );
    const spawn = only(untilFlying(sim), 'spawn');
    expect(spawn.layer.speed).toBeGreaterThan(0);
    const rime = dropAt(sim, 22);
    expect(only(rime, 'land').quality).toBe('perfect');
    expect(only(rime, 'effect_end').effect).toBe('frosty');
  });

  it('brownie of level 5 pays its change when the shield saves a miss', () => {
    const sim = crewAt(5, 'brownie');
    drop(sim, 40);
    expect(sim.state.shieldLevel).toBe(5);
    const events = missNow(sim);
    expect(only(events, 'miss').shielded).toBe(true);
    expect(masteryCoins(events)).toBe(MASTERY.brownie.shieldCoins);
    expect(sim.state.shieldLevel).toBe(0);
  });

  it('brownie of level 5 pays its change for a sneeze on the last layer its shield covers', () => {
    const sim = crewAt(5, 'brownie');
    drop(sim, 40);
    const layers = sim.state.shield;
    for (let i = 1; i < layers; i++) drop(sim, 30);
    expect(sim.state.shield).toBe(1);
    const events = sneezeDrop(sim);
    expect(only(events, 'wobble_sneeze')).toBeTruthy();
    expect(only(events, 'miss').shielded).toBe(true);
    expect(masteryCoins(events)).toBe(MASTERY.brownie.shieldCoins);
  });

  it('brownie below level 5 pays nothing for a save', () => {
    const sim = crewAt(4, 'brownie');
    drop(sim, 40);
    expect(masteryCoins(missNow(sim))).toBe(0);
  });

  it('caramel of level 5 pays a golden layer thrice', () => {
    // Layer 24 is the creature slot (6, 12, 18, 24), layer 25 the golden one.
    const sim = crewAt(5, 'caramel', 23);
    drop(sim, 40);
    const events = drop(sim, 40);
    expect(only(events, 'golden').perfect).toBe(false);
    const golden = pick(events, 'coin_collect').filter((e) => e.source === 'golden');
    expect(golden.map((e) => e.amount)).toEqual([BALANCE.golden.normalCoins]);
    expect(masteryCoins(events)).toBe(BALANCE.golden.normalCoins * 2);
  });

  it('ghost of level 5 reports the clouds it makes see-through', () => {
    // The clouds zone starts at layer 61; a long ghost effect covers every layer of the test.
    const sim = new TowerSim(config({ startHeight: 60 }));
    mutable(sim).effects.push({ id: 'ghost', layersLeft: 99, level: 5, boosted: false, value: 0 });
    let seen = false;
    for (let layer = 0; layer < 20 && !seen; layer++) {
      const events = drop(sim, 0);
      const clouds = pick(events, 'cloud');
      if (clouds.length === 0) continue;
      seen = true;
      expect(pick(events, 'mastery')).toEqual(
        clouds.map(() => ({ type: 'mastery', creature: 'ghost', coins: 0, score: 0 })),
      );
    }
    expect(seen).toBe(true);
  });
});
