import { Rng } from '../src/core/rng';
import type { RunResult } from '../src/core/run-result';
import { TowerSim } from '../src/core/tower-sim';
import { BALANCE, DIFFICULTY, type DifficultyTarget } from '../src/data/balance';

const STEP_MS = BALANCE.sim.stepMs;
const BASE_SEED = 20261113;
/** Safety net for a bot that never misses. */
const MAX_RUN_MS = 60 * 60 * 1000;

/** Standard normal value (Box–Muller). */
function gaussian(rng: Rng): number {
  const u = 1 - rng.next();
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Bot player: aims at the first pass over the tower top and taps with a
 * normally distributed timing error. It never continues a run.
 */
function playRun(seed: number, timingSdMs: number, noise: Rng): RunResult {
  const sim = new TowerSim({ seed, mode: 'classic', team: [null, null, null], tutorial: false });
  let errorMs = 0;

  for (let elapsed = 0; elapsed < MAX_RUN_MS; elapsed += STEP_MS) {
    const events = sim.update(STEP_MS);
    if (sim.state.phase === 'await_continue') events.push(...sim.decline());

    for (const event of events) {
      if (event.type === 'spawn') errorMs = gaussian(noise) * timingSdMs;
      if (event.type === 'run_over') return event.result;
    }

    const flying = sim.state.flying;
    if (sim.state.phase === 'flying' && flying) {
      const msToTarget = (((sim.topLayerX() - flying.x) * flying.dir) / flying.speed) * 1000;
      if (msToTarget <= -errorMs) sim.drop();
    }
  }
  throw new Error(`Run with seed ${seed} did not end`);
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index] ?? 0;
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function verdict(median: number, [min, max]: DifficultyTarget['medianHeight']): string {
  if (median >= min && median <= max) return 'ok';
  const { tolerance } = DIFFICULTY;
  if (median >= min * (1 - tolerance) && median <= max * (1 + tolerance)) return 'near';
  return 'OFF';
}

function simulate(target: DifficultyTarget): Record<string, string | number> {
  const seeds = new Rng(BASE_SEED).fork(`seeds:${target.id}`);
  const noise = new Rng(BASE_SEED).fork(`noise:${target.id}`);
  const results: RunResult[] = [];
  for (let i = 0; i < DIFFICULTY.runsPerProfile; i++) {
    results.push(playRun(seeds.int(0, 0xffffffff), target.timingSdMs, noise));
  }

  const heights = results.map((r) => r.height).sort((a, b) => a - b);
  const median = percentile(heights, 0.5);
  return {
    profile: target.id,
    'sd, ms': target.timingSdMs,
    median,
    p90: percentile(heights, 0.9),
    'avg score': Math.round(mean(results.map((r) => r.score))),
    'avg coins': Math.round(mean(results.map((r) => r.coins))),
    'avg time, s': Number((mean(results.map((r) => r.durationMs)) / 1000).toFixed(1)),
    'perfect, %': Math.round(
      (100 * mean(results.map((r) => r.perfects))) / Math.max(1, mean(heights)),
    ),
    target: target.medianHeight.join('–'),
    status: verdict(median, target.medianHeight),
  };
}

console.log(`Runs per profile: ${DIFFICULTY.runsPerProfile}, team: none, continues: declined`);
console.table(DIFFICULTY.targets.map(simulate));
console.log(
  `status: ok = median inside the target range, near = within ${DIFFICULTY.tolerance * 100}% of it, OFF = balance needs changes`,
);
