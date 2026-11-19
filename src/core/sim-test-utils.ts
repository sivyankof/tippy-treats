import { expect } from 'vitest';
import { BALANCE } from '../data/tower/balance';
import { TowerSim, type RunConfig, type SimEvent, type TowerState } from './tower-sim';

export const STEP = BALANCE.sim.stepMs;
export const MAX_STEPS = 120 * 60;

export const config = (overrides: Partial<RunConfig> = {}): RunConfig => ({
  seed: 12345,
  mode: 'classic',
  team: [null, null, null],
  tutorial: false,
  ...overrides,
});

export type EventOf<T extends SimEvent['type']> = Extract<SimEvent, { type: T }>;

export const pick = <T extends SimEvent['type']>(events: SimEvent[], type: T): EventOf<T>[] =>
  events.filter((e): e is EventOf<T> => e.type === type);

export const only = <T extends SimEvent['type']>(events: SimEvent[], type: T): EventOf<T> => {
  const found = pick(events, type);
  expect(found).toHaveLength(1);
  return found[0] as EventOf<T>;
};

/** Test-only access to tweak the state the simulation exposes as read-only. */
export const mutable = (sim: TowerSim): TowerState => sim.state as TowerState;

/** Steps until the predicate holds; returns every event seen on the way. */
export function runUntil(sim: TowerSim, done: () => boolean): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < MAX_STEPS && !done(); i++) {
    events.push(...sim.update(STEP));
  }
  expect(done()).toBe(true);
  return events;
}

export const untilFlying = (sim: TowerSim): SimEvent[] =>
  runUntil(sim, () => sim.state.phase === 'flying');

export const untilSettled = (sim: TowerSim): SimEvent[] =>
  runUntil(sim, () => sim.state.phase !== 'falling');

/**
 * Waits for a layer, drops it once it has travelled `offset` past the target
 * (in its direction of travel) and returns the events up to the landing.
 */
export function dropAt(sim: TowerSim, offset: number): SimEvent[] {
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

export const dropNow = (sim: TowerSim): SimEvent[] => {
  const events = untilFlying(sim);
  sim.drop();
  return [...events, ...untilSettled(sim)];
};

/**
 * Waits for a layer, makes it narrow and drops it 22 off-centre with the wobble loaded: a sneeze
 * miss. The sway is timed to cross zero at the landing, so the offset is not shifted by it.
 */
export function sneezeDrop(sim: TowerSim): SimEvent[] {
  untilFlying(sim);
  const state = mutable(sim);
  if (state.flying) {
    state.flying.width = 50;
    state.flying.speed = 120;
  }
  state.wobble = 0;
  const events = untilFlying(sim);
  const passed = (): boolean => {
    const flying = sim.state.flying;
    return !!flying && (flying.x - sim.topLayerX()) * flying.dir >= 22;
  };
  events.push(...runUntil(sim, () => !passed()), ...runUntil(sim, passed));
  sim.drop();
  state.wobble = 99;
  const fallSteps = Math.ceil(BALANCE.layer.fallMs / STEP);
  state.wobblePhase = -((fallSteps * 2 * Math.PI * STEP) / BALANCE.wobble.periodMs);
  return [...events, ...untilSettled(sim)];
}
