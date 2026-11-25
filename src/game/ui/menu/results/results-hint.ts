import { nearMiss } from '../../../../core/run/near-miss';
import { t } from '../../../../i18n';
import { gameState } from '../../../../state';
import type { ResultsData } from '../../../app/scene-keys';
import { dailyAttemptText, dailyProgressText } from '../daily/daily-text';
import { resultsLines, type ResultsLines } from './results-lines';
import { startedLine } from './results-start-model';
import { nearMissText } from './results-text';

/**
 * The lines of the results: what stands under the height and the hint at the bottom of the
 * Missions frame (docs/07-ui-screens.md, section 6). A run that is not saved gained no XP and set
 * no record: it has no "so close" line.
 */
export function resultsLinesOf(data: ResultsData, missionsFrame: boolean): ResultsLines {
  const { result, summary } = data;
  const daily = result.mode === 'daily';
  const started =
    data.checkpoint === null
      ? null
      : t('results.startedAt', startedLine(data.startHeight, result.height));
  let hint: { text: string; towardRecord: boolean } | null = null;
  if (data.recorded && daily && !summary.dailyStale) {
    hint = {
      text: dailyProgressText(data.dailyBest ?? gameState.dailyInfo().best, true),
      towardRecord: false,
    };
  } else if (data.recorded && !daily) {
    const miss = nearMiss({
      height: result.height,
      previousRecord: summary.previousRecord,
      bakerLevel: gameState.data.bakerLevel,
      bakerXp: gameState.data.bakerXp,
      coins: gameState.coins,
      owned: gameState.data.creatures,
      todayBest: gameState.todayBest,
      missions: summary.missions.after,
    });
    hint = { text: nearMissText(miss), towardRecord: miss.kind === 'record' };
  }
  return resultsLines({
    record: summary.isRecord ? t('run.newRecord') : null,
    started,
    // A daily attempt that did not reach the save counted for nothing: no line about it.
    daily:
      daily && data.recorded
        ? summary.dailyStale
          ? t('resultsDaily.stale')
          : dailyAttemptText(result.height)
        : null,
    hint,
    missionsFrame,
  });
}
