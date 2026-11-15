import { describe, expect, it } from 'vitest';
import type { TowerSim } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { createDriver, IdleDriver, MissDriver } from './perf-drivers';

type SimView = Pick<TowerSim, 'state' | 'topLayerX' | 'currentModifiers'>;

function simWith(flyingX: number, width: number, topX = 540): SimView {
  return {
    state: { phase: 'flying', flying: { x: flyingX, width } },
    topLayerX: () => topX,
    currentModifiers: () => ({}),
  } as unknown as SimView;
}

describe('IdleDriver', () => {
  it('never taps', () => {
    expect(new IdleDriver().shouldDrop()).toBe(false);
  });
});

describe('MissDriver', () => {
  const width = 240;
  const far = 540 + width - BALANCE.drop.missMargin + 10;

  it('waits to be armed', () => {
    const driver = new MissDriver();
    expect(driver.shouldDrop(simWith(far, width))).toBe(false);
    expect(driver.fired).toBe(false);
  });

  it('does not tap while the layer is over the tower', () => {
    const driver = new MissDriver();
    driver.arm();
    expect(driver.shouldDrop(simWith(540, width))).toBe(false);
  });

  it('taps once, when the layer is far enough to miss', () => {
    const driver = new MissDriver();
    driver.arm();
    expect(driver.shouldDrop(simWith(far, width))).toBe(true);
    expect(driver.fired).toBe(true);
    expect(driver.shouldDrop(simWith(far, width))).toBe(false);
  });
});

describe('createDriver', () => {
  it('builds the driver of each kind', () => {
    expect(createDriver({ kind: 'idle' }, 1)).toBeInstanceOf(IdleDriver);
    expect(createDriver({ kind: 'miss' }, 1)).toBeInstanceOf(MissDriver);
    expect(typeof createDriver({ kind: 'bot', sdMs: 5 }, 1).shouldDrop).toBe('function');
  });
});
