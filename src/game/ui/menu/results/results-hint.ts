import type * as Phaser from 'phaser';
import { nearMiss } from '../../../../core/run/near-miss';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { gameState } from '../../../../state';
import type { ResultsData } from '../../../app/scene-keys';
import { createOutlinedText } from '../../common/outlined-text';
import { dailyResultsText } from '../daily/daily-text';
import { fitText } from '../widgets/fit-text';
import { nearMissText } from './results-text';

const cfg = MENU.results;

/**
 * The "so close" line under the blocks; a daily run shows two: the tier of the attempt and the
 * day's progress. A run that is not saved gained no XP and set no record: the line stays out.
 */
export function createResultsHint(scene: Phaser.Scene, data: ResultsData): Phaser.GameObjects.Text {
  const { result, summary } = data;
  const text =
    result.mode === 'daily'
      ? dailyResultsText(result.height, gameState.dailyInfo().best, summary.dailyStale)
      : nearMissText(
          nearMiss({
            height: result.height,
            previousRecord: summary.previousRecord,
            bakerLevel: gameState.data.bakerLevel,
            bakerXp: gameState.data.bakerXp,
            coins: gameState.coins,
            owned: gameState.data.creatures,
            todayBest: gameState.todayBest,
            missions: summary.missions.after,
          }),
        );
  const hint = createOutlinedText(scene, 0, 0, text, cfg.nearMissFont, PALETTE.gold);
  hint.setAlign('center');
  fitText(hint, cfg.nearMissWidth);
  return hint.setVisible(data.recorded);
}
