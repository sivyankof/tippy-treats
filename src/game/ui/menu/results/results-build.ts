import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { gameState } from '../../../../state';
import { isDebugRun, isLiveRun } from '../../../run/results-data';
import type { ResultsData } from '../../../app/scene-keys';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import { movedMissions } from '../missions/missions-model';
import { createDebugPlate } from './results-debug-plate';
import { ResultsCoins } from './results-coins';
import { resultsLinesOf } from './results-hint';
import { headerLineCount, type ResultsLines } from './results-lines';
import { ResultsMissions } from './results-missions';
import { FRAME_INNER, levelBarWidth } from './results-model';
import type { PanelParts } from './results-panel';
import { createTeamContent, createTeamRow } from './results-team';
import { coinLines } from './results-text';
import { createTierRows } from './results-tiers';
import { createScoreTile, tileWidth } from './results-tiles';
import { ResultsXp } from './results-xp';

const cfg = MENU.results;

/** The lines under the height and in the Missions frame; the frame shows when the run moved a mission. */
export function resultsLinesFor(run: ResultsData): ResultsLines {
  const { before, after } = run.summary.missions;
  const moved = movedMissions(before, after).slice(0, cfg.missions.maxRows).length;
  return resultsLinesOf(run, moved > 0);
}

/** Everything the frames show: tiles, level row, reward rows, team, missions and their hint. */
export function createResultsParts(
  scene: Phaser.Scene,
  run: ResultsData,
  lines: ResultsLines,
): PanelParts {
  const { result, summary, tally, recorded } = run;
  const width = tileWidth(FRAME_INNER, recorded ? 3 : 2);
  // The coins of a daily run are not doubled by an ad: that place is for the classic run only.
  const canDouble = isLiveRun(run) && result.mode !== 'daily';
  const coins = new ResultsCoins(scene, result.coins, coinLines(tally), canDouble, width);
  // A run that is not saved gained no XP: no XP tile, no level row.
  const xp = recorded
    ? new ResultsXp(
        scene,
        summary,
        run.xpEnd ?? { level: gameState.data.bakerLevel, xp: gameState.data.bakerXp },
        width,
        levelBarWidth(coins.button !== null),
      )
    : null;
  const missions = new ResultsMissions(
    scene,
    summary.missions.before,
    summary.missions.after,
    cfg.missions.maxRows,
  );
  const missionHint = lines.missionHint
    ? fitText(
        createOutlinedText(scene, 0, 0, lines.missionHint, cfg.missions.hintFont, PALETTE.gold),
        FRAME_INNER,
      )
    : null;
  const tierRows = createTierRows(scene, summary.dailyTiers, summary.lapBerries, FRAME_INNER);
  const debugPlate = isDebugRun(recorded, import.meta.env.DEV) ? createDebugPlate(scene).obj : null;
  return {
    content: {
      debugPlate: debugPlate !== null,
      recorded,
      levelUp: xp?.reachesLevel ?? false,
      ovenOut: recorded && (summary.oven?.ranOut ?? false),
      tierRows: tierRows.length,
      missions: missions.count,
      missionHint: missionHint !== null,
      headerLines: headerLineCount(lines.header),
    },
    debugPlate,
    coins,
    xp,
    scoreTile: createScoreTile(scene, result, width),
    tileWidth: width,
    tierRows,
    team: createTeamContent(scene, result, tally, FRAME_INNER),
    teamRow: createTeamRow(scene, result, tally, FRAME_INNER),
    missions,
    missionHint,
  };
}
