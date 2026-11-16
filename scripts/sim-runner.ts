import { TimingBot } from '../src/core/bot';
import { Rng } from '../src/core/rng';
import type { RunResult } from '../src/core/run-result';
import type { RunConfig } from '../src/core/sim-types';
import { TowerSim } from '../src/core/tower-sim';
import { BALANCE, type DifficultyTarget } from '../src/data/balance';
import type { CreatureId } from '../src/data/creatures';
import type { SimTeamSet } from '../src/data/sim-teams';
import type { RunObserver } from './run-observer';

/** Shared by the sim scripts: one bot run and the small statistics helpers. */

const STEP_MS = BALANCE.sim.stepMs;
export const BASE_SEED = 20261113;
/** Safety net for a bot that never misses. */
/** A bot with a strong team may never miss; analysis runs are cut off at this height. */
export const ANALYSIS_MAX_HEIGHT = 1500;
const MAX_RUN_MS = 60 * 60 * 1000;

/** The part of a difficulty target that decides how the bot plays. */
export type BotProfile = Pick<DifficultyTarget, 'timingSdMs'>;

/**
 * One bot run. The bot never continues a run. `observers` collect statistics without changing it.
 * A run that reaches `maxHeight` is cut off and returned as a `quit` result.
 */
export function playRun(
  config: RunConfig,
  profile: BotProfile,
  noise: Rng,
  observers: readonly RunObserver[] = [],
  maxHeight = Infinity,
): RunResult {
  const sim = new TowerSim(config);
  const bot = new TimingBot(profile.timingSdMs, noise);

  for (let elapsed = 0; elapsed < MAX_RUN_MS; elapsed += STEP_MS) {
    for (const observer of observers) observer.beforeStep?.(sim.state);
    const events = sim.update(STEP_MS);
    if (sim.state.phase === 'await_continue') events.push(...sim.decline());
    bot.observe(events);
    for (const observer of observers) observer.noteEvents?.(events, sim.state);

    for (const event of events) {
      if (event.type === 'run_over') return event.result;
    }

    if (sim.state.height >= maxHeight) {
      for (const observer of observers) observer.noteCensored?.(sim.state);
      const cut = sim.quitResult();
      if (cut) return cut;
    }

    if (bot.shouldDrop(sim)) {
      for (const observer of observers) observer.noteDrop?.(sim.state);
      sim.drop();
    }
  }
  throw new Error(`Run with seed ${config.seed} did not end`);
}

/** `p` in 0..1 of an ascending list. */
export function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index] ?? 0;
}

export const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * The team slots of a set at one creature level, or at a level per creature; missing creatures
 * leave empty slots.
 */
export const teamSlots = (
  set: SimTeamSet,
  level: number | ((id: CreatureId) => number),
): RunConfig['team'] =>
  Array.from({ length: BALANCE.team.slots }, (_, i) => {
    const id = set.creatures[i];
    if (!id) return null;
    return { id, level: typeof level === 'number' ? level : level(id) };
  });

/** Seeds and bot noise of a profile: the same for every team, so teams are compared on equal runs. */
export function profileStreams(profileId: string): { seeds: Rng; noise: Rng } {
  return {
    seeds: new Rng(BASE_SEED).fork(`seeds:${profileId}`),
    noise: new Rng(BASE_SEED).fork(`noise:${profileId}`),
  };
}
