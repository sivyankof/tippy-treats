import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import type { RunResult } from './run-result';
import { TowerSim, type RunConfig, type SimEvent, type TowerState } from './tower-sim';

const STEP = BALANCE.sim.stepMs;
const SPEED = BALANCE.speed;
const MAX_STEPS = 120 * 60;

const config = (overrides: Partial<RunConfig> = {}): RunConfig => ({
  seed: 12345,
  mode: 'classic',
  team: [null, null, null],
  tutorial: false,
  ...overrides,
});

type EventOf<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;

const pick = <T extends SimEvent['type']>(events: SimEvent[], type: T): EventOf<T>[] =>
  events.filter((e): e is EventOf<T> => e.type === type);

const only = <T extends SimEvent['type']>(events: SimEvent[], type: T): EventOf<T> => {
  const found = pick(events, type);
  expect(found).toHaveLength(1);
  return found[0] as EventOf<T>;
};

/** Test-only access to tweak the state the simulation exposes as read-only. */
const mutable = (sim: TowerSim): TowerState => sim.state as TowerState;

/** Steps until the predicate holds; returns every event seen on the way. */
function runUntil(sim: TowerSim, done: () => boolean): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < MAX_STEPS && !done(); i++) {
    events.push(...sim.update(STEP));
  }
  expect(done()).toBe(true);
  return events;
}

const untilFlying = (sim: TowerSim): SimEvent[] =>
  runUntil(sim, () => sim.state.phase === 'flying');

const untilSettled = (sim: TowerSim): SimEvent[] =>
  runUntil(sim, () => sim.state.phase !== 'falling');

/**
 * Waits for a layer, drops it once it has travelled `offset` past the target
 * (in its direction of travel) and returns the events up to the landing.
 */
function dropAt(sim: TowerSim, offset: number): SimEvent[] {
  const events = untilFlying(sim);
  const passed = (): boolean => {
    const flying = sim.state.flying;
    return !!flying && (flying.x - sim.topLayerX()) * flying.dir >= offset;
  };
  // A layer that is already past the point has to come round again.
  events.push(...runUntil(sim, () => !passed()));
  events.push(...runUntil(sim, passed));
  sim.drop();
  events.push(...untilSettled(sim));
  return events;
}

const dropNow = (sim: TowerSim): SimEvent[] => {
  const events = untilFlying(sim);
  sim.drop();
  return [...events, ...untilSettled(sim)];
};

/** Two instant drops: the first leaves a 320-wide layer on the left, the second misses it. */
function missOnSecondLayer(sim: TowerSim): SimEvent[] {
  dropNow(sim);
  return dropNow(sim);
}

describe('TowerSim: flight', () => {
  it('spawns the first layer on the first step', () => {
    const sim = new TowerSim(config());
    const spawn = only(sim.update(STEP), 'spawn');
    expect(spawn.layer).toMatchObject({
      index: 1,
      x: 140,
      width: 720,
      dir: 1,
      speed: SPEED.base,
      kind: 'plain',
    });
    expect(sim.state.phase).toBe('flying');
    expect(sim.topLayerX()).toBe(540);
  });

  it('moves at a constant speed and bounces between the bounds', () => {
    const sim = new TowerSim(config());
    untilFlying(sim);
    sim.update(1000);
    // maxFrameMs caps a long frame at 250 ms: 30 steps at the base speed.
    expect(sim.state.flying?.x).toBeCloseTo(140 + SPEED.base * 0.25, 5);

    const xs: number[] = [];
    let turns = 0;
    let dir = sim.state.flying?.dir;
    for (let i = 0; i < 120 * 8; i++) {
      sim.update(STEP);
      const flying = sim.state.flying;
      if (!flying) break;
      xs.push(flying.x);
      if (flying.dir !== dir) {
        turns++;
        dir = flying.dir;
      }
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(140);
    expect(Math.max(...xs)).toBeLessThanOrEqual(940);
    expect(turns).toBeGreaterThanOrEqual(4);
  });

  it('alternates the spawn side and speeds up with height', () => {
    const sim = new TowerSim(config());
    dropAt(sim, 0);
    const second = only(untilFlying(sim), 'spawn').layer;
    expect(second).toMatchObject({ index: 2, x: 940, dir: -1, speed: SPEED.base + SPEED.perLayer });
    dropAt(sim, 0);
    const third = only(untilFlying(sim), 'spawn').layer;
    expect(third).toMatchObject({
      index: 3,
      x: 140,
      dir: 1,
      speed: SPEED.base + SPEED.perLayer * 2,
    });
  });

  it('ignores taps while the layer is falling or the next one is not out yet', () => {
    const sim = new TowerSim(config());
    expect(sim.drop()).toEqual([]);
    expect(sim.state.phase).toBe('pause');

    untilFlying(sim);
    sim.drop();
    expect(sim.state.phase).toBe('falling');
    sim.update(STEP);
    const fallMs = sim.state.phaseMs;
    sim.drop();
    expect(sim.state.phase).toBe('falling');
    expect(sim.state.phaseMs).toBe(fallMs);

    untilSettled(sim);
    expect(sim.state.phase).toBe('pause');
    sim.drop();
    expect(sim.state.phase).toBe('pause');
    expect(sim.state.height).toBe(1);
  });

  it('lands 110 ms after the tap and waits 220 ms before the next layer', () => {
    const sim = new TowerSim(config());
    untilFlying(sim);
    sim.drop();
    let fallSteps = 0;
    while (sim.state.phase === 'falling') {
      sim.update(STEP);
      fallSteps++;
    }
    expect(fallSteps).toBe(Math.ceil(BALANCE.layer.fallMs / STEP));
    let pauseSteps = 0;
    while (sim.state.phase === 'pause') {
      sim.update(STEP);
      pauseSteps++;
    }
    expect(pauseSteps).toBe(Math.ceil(BALANCE.layer.spawnPauseMs / STEP));
  });
});

describe('TowerSim: startHeight', () => {
  it('pre-places perfect full-width layers and spawns the next index', () => {
    const sim = new TowerSim(config({ startHeight: 5 }));
    expect(sim.state.height).toBe(5);
    expect(sim.state.layers).toHaveLength(5);
    for (const layer of sim.state.layers) {
      expect(layer).toEqual({
        x: BALANCE.tray.centerX,
        width: BALANCE.layer.firstWidth,
        kind: 'plain',
        quality: 'perfect',
      });
    }
    expect(sim.state.score).toBe(0);
    expect(sim.state.combo).toBe(0);

    untilFlying(sim);
    const flying = sim.state.flying;
    expect(flying?.index).toBe(6);
    expect(flying?.dir).toBe(-1);
    expect(flying?.x).toBe(BALANCE.layer.maxCenterX);
    expect(flying?.width).toBe(BALANCE.layer.firstWidth);
  });

  it('floors fractions and clamps negatives to zero', () => {
    expect(new TowerSim(config({ startHeight: 3.9 })).state.height).toBe(3);
    expect(new TowerSim(config({ startHeight: -4 })).state.height).toBe(0);
    expect(new TowerSim(config({ startHeight: 0 })).state.layers).toHaveLength(0);
  });
});

describe('TowerSim: landing', () => {
  it('snaps a perfect drop to the centre and keeps the width', () => {
    const sim = new TowerSim(config());
    const events = dropAt(sim, 0);
    const land = only(events, 'land');
    expect(land).toMatchObject({ quality: 'perfect', cutWidth: 0, cutSide: null, newWidth: 720 });
    expect(Math.abs(land.dx)).toBeLessThanOrEqual(BALANCE.drop.perfectTolerance);
    expect(only(events, 'combo')).toEqual({ type: 'combo', value: 1, widened: 0 });
    expect(sim.state).toMatchObject({ height: 1, score: 30, combo: 1, bestCombo: 1, wobble: 0 });
    expect(sim.state.layers).toEqual([{ x: 540, width: 720, kind: 'plain', quality: 'perfect' }]);
  });

  it('cuts the overhang on a normal drop and starts the wobble', () => {
    const sim = new TowerSim(config());
    const land = only(dropAt(sim, 100), 'land');
    expect(land.quality).toBe('normal');
    expect(land.cutSide).toBe('right');
    expect(land.dx).toBeGreaterThanOrEqual(100);
    expect(land.dx).toBeLessThan(106);
    expect(land.cutWidth).toBeCloseTo(land.dx);
    expect(land.newWidth).toBeCloseTo(720 - land.dx);

    const layer = sim.state.layers[0];
    expect(layer?.x).toBeCloseTo(540 + land.dx / 2);
    expect(layer?.width).toBeCloseTo(720 - land.dx);
    expect(sim.state).toMatchObject({ height: 1, score: 10, combo: 0 });
    expect(sim.state.wobble).toBeCloseTo((60 * land.dx) / 720, 5);

    const next = only(untilFlying(sim), 'spawn').layer;
    expect(next.width).toBeCloseTo(720 - land.dx);
  });

  it('aims at the swaying top layer, not at its resting place', () => {
    const sim = new TowerSim(config());
    dropAt(sim, 250);
    untilFlying(sim);
    const rest = sim.state.layers[0]?.x ?? 0;
    let maxSway = 0;
    for (let i = 0; i < 120 * 3 && sim.state.phase === 'flying'; i++) {
      sim.update(STEP);
      maxSway = Math.max(maxSway, Math.abs(sim.topLayerX() - rest));
    }
    expect(maxSway).toBeGreaterThan(1);

    const land = only(dropAt(sim, 0), 'land');
    expect(land.quality).toBe('perfect');
    expect(sim.state.layers[1]?.x).toBe(rest);
  });

  it('resets the combo on a normal drop and widens from the second perfect in a row', () => {
    const sim = new TowerSim(config());
    dropAt(sim, 200);
    const widthAfterCut = sim.state.layers[0]?.width ?? 0;
    const combos: number[] = [];
    const widened: number[] = [];
    for (let i = 0; i < 5; i++) {
      const combo = only(dropAt(sim, 0), 'combo');
      combos.push(combo.value);
      widened.push(combo.widened);
    }
    expect(combos).toEqual([1, 2, 3, 4, 5]);
    expect(widened).toEqual([0, 30, 30, 30, 30]);
    expect(sim.state.layers.at(-1)?.width).toBeCloseTo(widthAfterCut + 120);
    expect(sim.state.score).toBe(10 + 30 + 35 + 40 + 45 + 50);

    dropAt(sim, 60);
    expect(sim.state.combo).toBe(0);
    expect(sim.state.bestCombo).toBe(5);
  });

  it('calms the wobble with perfect drops and with time', () => {
    const sim = new TowerSim(config());
    dropAt(sim, 300);
    const start = sim.state.wobble;
    expect(start).toBeGreaterThan(24);
    untilFlying(sim);
    const beforeWait = sim.state.wobble;
    for (let i = 0; i < 120; i++) sim.update(STEP);
    expect(beforeWait - sim.state.wobble).toBeCloseTo(BALANCE.wobble.decayPerSec, 5);

    const beforePerfect = sim.state.wobble;
    dropAt(sim, 0);
    expect(sim.state.wobble).toBeLessThan(beforePerfect - 14);
  });
});

describe('TowerSim: sneeze', () => {
  it('shrinks the top layer by 15% and halves the wobble at 100', () => {
    const sim = new TowerSim(config());
    untilFlying(sim);
    mutable(sim).wobble = 99;
    const events = dropAt(sim, 100);
    const land = only(events, 'land');
    const sneeze = only(events, 'wobble_sneeze');
    expect(sneeze.newWidth).toBeCloseTo(land.newWidth * 0.85);
    expect(sim.state.layers[0]?.width).toBeCloseTo(land.newWidth * 0.85);
    expect(sim.state.wobble).toBe(50);
    expect(sim.state.phase).toBe('pause');
    expect(only(untilFlying(sim), 'spawn').layer.width).toBeCloseTo(land.newWidth * 0.85);
  });

  it('counts as a miss when the sneeze leaves less than the margin', () => {
    const sim = new TowerSim(config({ mode: 'daily' }));
    untilFlying(sim);
    const state = mutable(sim);
    state.wobble = 99;
    if (state.flying) {
      state.flying.width = 50;
      state.flying.speed = 120;
    }
    const events = dropAt(sim, 22);
    expect(only(events, 'land').quality).toBe('normal');
    expect(only(events, 'wobble_sneeze').newWidth).toBeLessThan(BALANCE.drop.missMargin);
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: false });
    const result = only(events, 'run_over').result;
    expect(result).toMatchObject({ height: 1, endReason: 'sneeze' });
    expect(events.map((e) => e.type)).toEqual(['land', 'wobble_sneeze', 'miss', 'run_over']);
  });
});

describe('TowerSim: miss and continue', () => {
  it('offers to continue after a miss in classic mode', () => {
    const sim = new TowerSim(config());
    const events = missOnSecondLayer(sim);
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: false });
    expect(pick(events, 'run_over')).toHaveLength(0);
    expect(sim.state).toMatchObject({ phase: 'await_continue', height: 1, flying: null });
  });

  it('stands still while waiting for the decision', () => {
    const sim = new TowerSim(config());
    missOnSecondLayer(sim);
    const wobble = sim.state.wobble;
    expect(sim.update(5000)).toEqual([]);
    expect(sim.drop()).toEqual([]);
    expect(sim.state.phase).toBe('await_continue');
    expect(sim.state.wobble).toBe(wobble);
  });

  it('brings the layer back at 360 wide with no wobble on continue', () => {
    const sim = new TowerSim(config());
    missOnSecondLayer(sim);
    expect(sim.state.wobble).toBeGreaterThan(0);

    const spawn = only(sim.continueRun(), 'spawn');
    expect(spawn.layer).toMatchObject({ index: 2, width: 360, x: 940, dir: -1 });
    expect(sim.state).toMatchObject({ phase: 'flying', wobble: 0, continuesUsed: 1, combo: 0 });

    only(dropAt(sim, 0), 'land');
    expect(sim.state.height).toBe(2);
    expect(sim.state.layers[1]?.width).toBe(360);
  });

  it('keeps a layer that is already wider than the restore width', () => {
    const sim = new TowerSim(config());
    untilFlying(sim);
    const flying = mutable(sim).flying;
    if (flying) flying.x = 2000;
    sim.drop();
    only(untilSettled(sim), 'miss');
    expect(only(sim.continueRun(), 'spawn').layer.width).toBe(720);
  });

  it('allows two continues, then the run ends on the next miss', () => {
    const sim = new TowerSim(config());
    missOnSecondLayer(sim);
    for (let used = 1; used <= BALANCE.continues.max; used++) {
      sim.continueRun();
      expect(sim.state.continuesUsed).toBe(used);
      only(dropNow(sim), 'miss');
    }
    expect(sim.state.phase).toBe('over');
    expect(sim.continueRun()).toEqual([]);
    expect(sim.decline()).toEqual([]);
    expect(sim.update(1000)).toEqual([]);
  });

  it('ends the run with a result when the player declines', () => {
    const sim = new TowerSim(config({ seed: 777 }));
    dropAt(sim, 0);
    dropAt(sim, 0);
    for (let i = 0; i < 2; i++) dropNow(sim);
    expect(sim.state.phase).toBe('await_continue');

    const result = only(sim.decline(), 'run_over').result;
    expect(result).toEqual<RunResult>({
      seed: 777,
      mode: 'classic',
      height: sim.state.height,
      score: sim.state.score,
      coins: 0,
      berries: 0,
      perfects: 2,
      bestCombo: 2,
      continuesUsed: 0,
      zoneIndex: 0,
      durationMs: result.durationMs,
      endReason: 'miss',
    });
    expect(result.height).toBeGreaterThanOrEqual(2);
    expect(result.durationMs).toBeGreaterThan(1000);
    expect(sim.state.phase).toBe('over');
    expect(sim.continueRun()).toEqual([]);
  });

  it('has no continues in the daily tower', () => {
    const sim = new TowerSim(config({ mode: 'daily' }));
    const events = missOnSecondLayer(sim);
    only(events, 'miss');
    expect(only(events, 'run_over').result).toMatchObject({
      mode: 'daily',
      height: 1,
      continuesUsed: 0,
      endReason: 'miss',
    });
    expect(sim.state.phase).toBe('over');
  });
});

describe('TowerSim: determinism', () => {
  /**
   * Plays a scripted run: taps happen after the given simulation steps,
   * continues are declined. `stepsPerFrame` imitates the display frame rate.
   */
  function play(seed: number, tapSteps: number[], stepsPerFrame: number): RunResult {
    const sim = new TowerSim(config({ seed }));
    const taps = new Set(tapSteps);
    for (let step = stepsPerFrame; step < MAX_STEPS * 4; step += stepsPerFrame) {
      const events = sim.update(STEP * stepsPerFrame);
      if (taps.has(step)) sim.drop();
      if (sim.state.phase === 'await_continue') events.push(...sim.decline());
      const over = pick(events, 'run_over')[0];
      if (over) return over.result;
    }
    throw new Error('run did not end');
  }

  // Multiples of six steps, so the same script can be replayed at 120, 60 and 40 fps.
  const taps = [16, 33, 53, 72, 87, 110, 124, 147, 166, 187, 233, 300].map((n) => n * 6);

  it('gives the same result for the same seed and tap times', () => {
    const first = play(2026, taps, 1);
    expect(first.height).toBeGreaterThan(2);
    expect(play(2026, taps, 1)).toEqual(first);
  });

  it('does not depend on the frame rate', () => {
    const at120 = play(2026, taps, 1);
    expect(play(2026, taps, 2)).toEqual(at120);
    expect(play(2026, taps, 3)).toEqual(at120);
  });

  it('changes when the taps change', () => {
    const shifted = taps.map((t) => t + 12);
    expect(play(2026, shifted, 1)).not.toEqual(play(2026, taps, 1));
  });

  it('records the seed of the run', () => {
    expect(play(1, taps, 1).seed).toBe(1);
    expect(play(2, taps, 1)).toEqual({ ...play(1, taps, 1), seed: 2 });
  });
});
