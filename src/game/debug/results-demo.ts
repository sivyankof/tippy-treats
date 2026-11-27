import { lapRewardBerries } from '../../core/zones/space-laps';
import { checkpointRows, checkpointsReached } from '../../core/zones/checkpoints';
import type { RunResult } from '../../core/run/run-result';
import type { RunTally } from '../../core/run/run-tally';
import type { CheckpointHeight } from '../../core/zones/checkpoints';
import { RESULTS_DEMO, type ResultsDemoCase } from '../../data/debug/results-demo';
import { gameState } from '../../state';
import { EMPTY_SUMMARY, type RunSummary } from '../../state/game-state';
import type { ResultsData } from '../app/scene-keys';

/** The run of a case: classic unless it is the daily tower, higher after a checkpoint or a record. */
function demoResult(kind: ResultsDemoCase): RunResult {
  const coins = Object.values(RESULTS_DEMO.coins).reduce((sum, n) => sum + n, 0);
  const heights: Record<ResultsDemoCase, number> = {
    normal: RESULTS_DEMO.height,
    checkpoint: RESULTS_DEMO.checkpoint.height,
    record: RESULTS_DEMO.record.height,
    daily: RESULTS_DEMO.daily.height,
    lap: RESULTS_DEMO.lap.height,
    levelup: RESULTS_DEMO.height,
    longest: RESULTS_DEMO.record.height,
    dailyLevelup: RESULTS_DEMO.daily.height,
    checkpointLap: RESULTS_DEMO.checkpointLap.height,
  };
  return {
    seed: RESULTS_DEMO.seed,
    mode: isDaily(kind) ? 'daily' : 'classic',
    height: heights[kind],
    score: RESULTS_DEMO.score,
    coins,
    berries: 0,
    perfects: RESULTS_DEMO.perfects,
    bestCombo: RESULTS_DEMO.bestCombo,
    continuesUsed: 0,
    zoneIndex: 0,
    durationMs: RESULTS_DEMO.durationMs,
    endReason: 'miss',
  };
}

function isDaily(kind: ResultsDemoCase): boolean {
  return kind === 'daily' || kind === 'dailyLevelup';
}

/** The cases whose XP fill reaches a level. */
function reachesLevel(kind: ResultsDemoCase): boolean {
  return kind === 'levelup' || kind === 'longest' || kind === 'dailyLevelup';
}

/** Where the XP bar starts and ends: across a level for the level-up cases. */
function xpFill(kind: ResultsDemoCase): typeof RESULTS_DEMO.xp {
  return reachesLevel(kind) ? RESULTS_DEMO.levelUp : RESULTS_DEMO.xp;
}

/** The cases that set a new record. */
function isRecordCase(kind: ResultsDemoCase): boolean {
  return kind === 'record' || kind === 'longest';
}

/** The cases that start from a checkpoint, with the height they start from. */
function checkpointOf(kind: ResultsDemoCase): CheckpointHeight | null {
  if (kind === 'checkpoint') return RESULTS_DEMO.checkpoint.start;
  if (kind === 'checkpointLap') return RESULTS_DEMO.checkpointLap.start;
  return null;
}

function demoTally(): RunTally {
  const abilityByCreature: RunTally['abilityByCreature'] = {};
  let abilities = 0;
  for (const [id, count] of RESULTS_DEMO.abilities) {
    abilityByCreature[id] = count;
    abilities += count;
  }
  return {
    coins: { ...RESULTS_DEMO.coins },
    abilities,
    abilityByCreature,
    maxWobble: RESULTS_DEMO.maxWobble,
    flies: 0,
  };
}

function demoSummary(kind: ResultsDemoCase): RunSummary {
  const items = RESULTS_DEMO.missions.map(({ id, group, target, before, after }) => ({
    before: { id, group, target, progress: before, claimed: false },
    after: { id, group, target, progress: after, claimed: false },
  }));
  const daily = isDaily(kind);
  const record = isRecordCase(kind);
  return {
    ...EMPTY_SUMMARY,
    isRecord: record,
    previousRecord: record ? RESULTS_DEMO.previousRecordBeaten : RESULTS_DEMO.previousRecord,
    // The bar fills by the XP of the run; the demo does not change the save.
    before: { ...xpFill(kind).before },
    xpGained: RESULTS_DEMO.xpGained,
    oven: { ...RESULTS_DEMO.oven },
    missions: { before: items.map((m) => m.before), after: items.map((m) => m.after) },
    lapBerries:
      kind === 'lap' || kind === 'checkpointLap'
        ? lapRewardBerries(RESULTS_DEMO.lap.bestLap, demoResult(kind).height)
        : 0,
    dailyTiers: daily ? RESULTS_DEMO.daily.tiers.map((t) => ({ ...t, cost: { ...t.cost } })) : [],
  };
}

/** Dev only: the results of a run of `kind` with every block filled (`?resultsDemo=<case>`). */
export function resultsDemoData(kind: ResultsDemoCase): ResultsData {
  const checkpoint = checkpointOf(kind);
  // The checkpoints a run of that height would have opened, worked out here: the save stays as it is.
  const opened = checkpointsReached(Math.max(RESULTS_DEMO.priorRunHeight, demoResult(kind).height));
  return {
    result: demoResult(kind),
    summary: demoSummary(kind),
    tally: demoTally(),
    recorded: true,
    tower: { layers: [], cuts: [] },
    startHeight: checkpoint ?? 0,
    checkpoint,
    xpEnd: { ...xpFill(kind).after },
    // The best attempt of the day is this one at least (the demo does not record it).
    ...(isDaily(kind) ? { dailyBest: demoResult(kind).height } : {}),
    startOffer: {
      opened,
      rows: (adReady) =>
        checkpointRows({
          opened,
          berries: gameState.berries,
          adReady,
          adsLeft: gameState.checkpointAdsLeft,
        }),
    },
  };
}
