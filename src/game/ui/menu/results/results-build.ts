import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { gameState } from '../../../../state';
import { isDebugRun, isLiveRun } from '../../../run/results-data';
import type { ResultsData } from '../../../app/scene-keys';
import { createDebugPlate } from './results-debug-plate';
import { ResultsCoins } from './results-coins';
import { createResultsHint } from './results-hint';
import { ResultsMissions } from './results-missions';
import { ResultsTiers } from './results-tiers';
import { coinLines } from './results-text';
import { ResultsXp } from './results-xp';

const cfg = MENU.results;

/** The coins, the daily tiers and the missions of the results. */
export function createResultsBlocks(scene: Phaser.Scene, run: ResultsData) {
  const { result, summary, tally } = run;
  // The coins of a daily run are not doubled by an ad: that place is for the classic run only.
  const canDouble = isLiveRun(run) && result.mode !== 'daily';
  return {
    coins: new ResultsCoins(scene, result.coins, coinLines(tally), canDouble),
    tiers: new ResultsTiers(scene, summary.dailyTiers, summary.lapBerries),
    missions: new ResultsMissions(
      scene,
      summary.missions.before,
      summary.missions.after,
      cfg.missions.maxRows,
    ),
  };
}

/** The XP bar, the dev plate and the "so close" line of the results. */
export function createResultsFoot(scene: Phaser.Scene, run: ResultsData) {
  const xp = new ResultsXp(scene, run.summary, {
    level: gameState.data.bakerLevel,
    xp: gameState.data.bakerXp,
  });
  // A run that is not saved gained no XP and set no record: the XP block and the hint stay out.
  xp.container.setVisible(run.recorded);
  return {
    xp,
    debugPlate: isDebugRun(run.recorded, import.meta.env.DEV) ? createDebugPlate(scene) : null,
    hint: createResultsHint(scene, run),
  };
}
