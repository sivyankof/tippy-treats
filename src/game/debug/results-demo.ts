import { lapRewardBerries } from '../../core/space-laps';
import { checkpointRows, checkpointsReached } from '../../core/checkpoints';
import type { RunResult } from '../../core/run-result';
import type { RunTally } from '../../core/run-tally';
import { RESULTS_DEMO, type ResultsDemoCase } from '../../data/debug/results-demo';
import { gameState } from '../../state';
import { EMPTY_SUMMARY, type RunSummary } from '../../state/game-state';
import type { ResultsData } from '../scene-keys';

/** The run of a case: classic unless it is the daily tower, higher after a checkpoint or a record. */
function demoResult(kind: ResultsDemoCase): RunResult {
  const coins = Object.values(RESULTS_DEMO.coins).reduce((sum, n) => sum + n, 0);
  const heights = {
    normal: RESULTS_DEMO.height,
    checkpoint: RESULTS_DEMO.checkpoint.height,
    record: RESULTS_DEMO.record.height,
    daily: RESULTS_DEMO.daily.height,
    lap: RESULTS_DEMO.lap.height,
  };
  return {
    seed: RESULTS_DEMO.seed,
    mode: kind === 'daily' ? 'daily' : 'classic',
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
  };
}

function demoSummary(kind: ResultsDemoCase): RunSummary {
  const { bakerLevel: level, bakerXp: xp } = gameState.data;
  const items = RESULTS_DEMO.missions.map(({ id, group, target, before, after }) => ({
    before: { id, group, target, progress: before, claimed: false },
    after: { id, group, target, progress: after, claimed: false },
  }));
  const daily = kind === 'daily';
  return {
    ...EMPTY_SUMMARY,
    isRecord: kind === 'record',
    previousRecord:
      kind === 'record' ? RESULTS_DEMO.previousRecordBeaten : RESULTS_DEMO.previousRecord,
    // The bar stands where the save is: the demo does not change the save.
    before: { level, xp },
    xpGained: RESULTS_DEMO.xpGained,
    oven: { ...RESULTS_DEMO.oven },
    missions: { before: items.map((m) => m.before), after: items.map((m) => m.after) },
    lapBerries:
      kind === 'lap' ? lapRewardBerries(RESULTS_DEMO.lap.bestLap, RESULTS_DEMO.lap.height) : 0,
    dailyTiers: daily ? RESULTS_DEMO.daily.tiers.map((t) => ({ ...t, cost: { ...t.cost } })) : [],
  };
}

/** Dev only: the results of a run of `kind` with every block filled (`?resultsDemo=<case>`). */
export function resultsDemoData(kind: ResultsDemoCase): ResultsData {
  // The checkpoints a run of that height would have opened, worked out here: the save stays as it is.
  const opened = checkpointsReached(RESULTS_DEMO.priorRunHeight);
  const checkpoint = kind === 'checkpoint';
  return {
    result: demoResult(kind),
    summary: demoSummary(kind),
    tally: demoTally(),
    recorded: true,
    tower: { layers: [], cuts: [] },
    startHeight: checkpoint ? RESULTS_DEMO.checkpoint.start : 0,
    checkpoint: checkpoint ? RESULTS_DEMO.checkpoint.start : null,
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
