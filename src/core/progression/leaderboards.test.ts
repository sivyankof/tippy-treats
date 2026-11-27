import { describe, expect, it } from 'vitest';
import { BOARD_MAX } from '../../data/games/boards';
import { createDefaultSave } from '../save/defaults';
import { boardScores, isFairScore, newScores, sentKey } from './leaderboards';

const DAY = '2026-11-28';

function played() {
  const save = createDefaultSave(0, 'test');
  save.stats.runs = 3;
  save.records.classicHeight = 47;
  save.daily = { ...save.daily, day: DAY, best: 31 };
  return save;
}

describe('boardScores', () => {
  it('sends the best Classic height and the daily best of today', () => {
    expect(boardScores(played(), DAY)).toEqual([
      { board: 'classic_height', value: 47 },
      { board: 'daily_height', value: 31 },
    ]);
  });

  it('sends nothing before the first run', () => {
    expect(boardScores(createDefaultSave(0, 'test'), DAY)).toEqual([]);
  });

  it('keeps yesterday out of the daily board', () => {
    const scores = boardScores(played(), '2026-11-29');
    expect(scores.map((s) => s.board)).toEqual(['classic_height']);
  });

  it('leaves out a score above the limit of the board', () => {
    const save = played();
    save.records.classicHeight = BOARD_MAX.classic_height.max + 1;
    save.daily.best = BOARD_MAX.daily_height.max;
    expect(boardScores(save, DAY)).toEqual([
      { board: 'daily_height', value: BOARD_MAX.daily_height.max },
    ]);
  });
});

describe('isFairScore', () => {
  it('takes whole numbers from 1 up to the limit', () => {
    expect(isFairScore('classic_height', 1)).toBe(true);
    expect(isFairScore('classic_height', 0)).toBe(false);
    expect(isFairScore('classic_height', 2.5)).toBe(false);
    expect(isFairScore('classic_height', Number.NaN)).toBe(false);
  });
});

describe('newScores', () => {
  it('keeps only scores better than the sent ones, the daily one per day', () => {
    const scores = boardScores(played(), DAY);
    const sent = new Map([
      [sentKey('classic_height', DAY), 47],
      [sentKey('daily_height', '2026-11-27'), 90],
    ]);
    expect(newScores(scores, sent, DAY)).toEqual([{ board: 'daily_height', value: 31 }]);
    sent.set(sentKey('daily_height', DAY), 31);
    expect(newScores(scores, sent, DAY)).toEqual([]);
  });
});
