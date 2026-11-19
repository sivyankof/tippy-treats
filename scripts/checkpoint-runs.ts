import { checkpointStartWidth } from '../src/core/zones/checkpoints';
import type { SimEvent, TowerState } from '../src/core/tower/sim-types';
import { DIFFICULTY } from '../src/data/tower/balance';
import { CHECKPOINT_HEIGHTS, type CheckpointHeight } from '../src/data/zones/checkpoints';
import type { SimTeamSet } from '../src/data/debug/sim-teams';
import { MS_PER_SECOND } from '../src/util/math';
import { COIN_SOURCES, CoinStats, type CoinsBySource } from './coin-stats';
import type { RunObserver } from './run-observer';
import { ANALYSIS_MAX_HEIGHT, playRun, profileStreams, teamSlots } from './sim-runner';

/** Bot runs that start from a checkpoint (or from zero), shared by `npm run sim` and `sim:economy`. */

export type StartHeight = 0 | CheckpointHeight;
export const START_HEIGHTS: readonly StartHeight[] = [0, ...CHECKPOINT_HEIGHTS];

export interface CheckpointSample {
  start: StartHeight;
  /** Layers placed in this run (the pre-built ones are not counted). */
  placed: number;
  /** Start plus placed layers: the height of the result screen. */
  full: number;
  /** Coins by source, placed layers only. */
  c: CoinsBySource;
  coins: number;
  berries: number;
  seconds: number;
}

export interface CheckpointRunsOptions {
  profileId: string;
  team: SimTeamSet;
  level: number;
  start: StartHeight;
  runs: number;
  /** Seed and noise stream id; the same id gives the same runs for every start height. Default: the profile id. */
  streamId?: string;
  observers?: readonly RunObserver[];
}

export function playCheckpointRuns(options: CheckpointRunsOptions): CheckpointSample[] {
  const { profileId, team, level, start, runs, observers = [] } = options;
  const profile = DIFFICULTY.targets.find((t) => t.id === profileId);
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);
  const { seeds, noise } = profileStreams(options.streamId ?? profileId);
  const slots = teamSlots(team, level);
  const coinStats = new CoinStats();
  const out: CheckpointSample[] = [];
  for (let i = 0; i < runs; i += 1) {
    const result = playRun(
      {
        seed: seeds.int(0, 0xffffffff),
        mode: 'classic',
        team: slots,
        tutorial: false,
        ...(start === 0 ? {} : { startHeight: start, startWidth: checkpointStartWidth(start) }),
      },
      profile,
      noise,
      [coinStats, ...observers],
      ANALYSIS_MAX_HEIGHT,
    );
    const c = coinStats.runs[coinStats.runs.length - 1];
    if (!c) throw new Error('no coin stats');
    out.push({
      start,
      placed: result.height - start,
      full: result.height,
      c,
      coins: COIN_SOURCES.reduce((sum, source) => sum + c[source], 0),
      berries: result.berries,
      seconds: result.durationMs / MS_PER_SECOND,
    });
  }
  return out;
}

/**
 * Width of the top layer at every checkpoint height, for runs from zero without a team (the
 * twins' bonus height would shift the layer index). It is also the width of the next flying layer.
 */
export class WidthAtHeights implements RunObserver {
  readonly widths: Record<CheckpointHeight, number[]> = { 20: [], 40: [], 60: [], 80: [], 100: [] };
  private seen = new Set<number>();

  noteEvents(events: readonly SimEvent[], state: Readonly<TowerState>): void {
    for (const h of CHECKPOINT_HEIGHTS) {
      if (state.height < h || this.seen.has(h)) continue;
      const width = state.layers[h - 1]?.width;
      if (width === undefined) continue;
      this.widths[h].push(width);
      this.seen.add(h);
    }
    if (events.some((event) => event.type === 'run_over')) this.seen.clear();
  }

  noteCensored(): void {
    this.seen.clear();
  }
}
