import { describe, expect, it } from 'vitest';
import type { TowerSim } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import { createDriver, IdleDriver, MissDriver, OffsetDriver } from './perf-drivers';

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

describe('OffsetDriver', () => {
  const width = 200;

  it('waits while the layer is closer to the tower than wanted', () => {
    expect(new OffsetDriver(0.2).shouldDrop(simWith(540 + 0.1 * width, width))).toBe(false);
  });

  it('taps inside the window past the wanted offset, on either side', () => {
    expect(new OffsetDriver(0.2).shouldDrop(simWith(540 + 0.22 * width, width))).toBe(true);
    expect(new OffsetDriver(0.2).shouldDrop(simWith(540 - 0.22 * width, width))).toBe(true);
  });

  it('lets a layer that is too far off go by: it would miss', () => {
    expect(new OffsetDriver(0.2).shouldDrop(simWith(540 + 0.5 * width, width))).toBe(false);
  });

  it('does not tap unless a layer flies', () => {
    const sim = simWith(560, width);
    (sim.state as { phase: string }).phase = 'settling';
    expect(new OffsetDriver(0.1).shouldDrop(sim)).toBe(false);
  });

  it('tells the owner once a tap is made', () => {
    let told = 0;
    new OffsetDriver(0.2, () => told++).shouldDrop(simWith(540 + 0.22 * width, width));
    expect(told).toBe(1);
  });

  it('is built from a cut spec', () => {
    expect(createDriver({ kind: 'cut', share: 0.1 }, 1)).toBeInstanceOf(OffsetDriver);
  });
});
