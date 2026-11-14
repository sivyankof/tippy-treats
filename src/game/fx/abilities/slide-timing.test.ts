import { describe, expect, it } from 'vitest';
import { STEP, config, untilFlying } from '../../../core/sim-test-utils';
import { TowerSim } from '../../../core/tower-sim';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { BALANCE } from '../../../data/balance';

describe('jelly slide', () => {
  const { slideMs, slideMarginMs } = ABILITY_ANIM.jelly;

  it('ends before the next layer may spawn', () => {
    expect(slideMs).toBeGreaterThan(0);
    expect(slideMarginMs).toBeGreaterThan(0);
    expect(slideMs).toBeLessThanOrEqual(BALANCE.layer.spawnPauseMs - slideMarginMs);
    expect(slideMs).toBeLessThanOrEqual(BALANCE.layer.spawnPauseMs);
  });

  it('ends before the next layer really spawns in the sim', () => {
    const sim = new TowerSim(config());
    untilFlying(sim);
    sim.drop();
    let sinceLandMs = 0;
    let landed = false;
    // The slide starts on the `land` event and the sim spawns the next layer after the pause.
    for (let i = 0; i < 1000; i++) {
      const events = sim.update(STEP);
      if (landed) sinceLandMs += STEP;
      if (events.some((e) => e.type === 'land')) landed = true;
      if (landed && events.some((e) => e.type === 'spawn')) break;
    }
    expect(landed).toBe(true);
    expect(sinceLandMs).toBeGreaterThanOrEqual(BALANCE.layer.spawnPauseMs - STEP);
    expect(slideMs).toBeLessThan(sinceLandMs);
  });
});
