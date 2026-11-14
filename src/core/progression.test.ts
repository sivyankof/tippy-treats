import { describe, expect, it } from 'vitest';
import { addXp, levelReward, xpForRun, xpToNext } from './progression';

describe('xpToNext', () => {
  it('follows 40 + 25 * (level - 1)', () => {
    expect(xpToNext(1)).toBe(40);
    expect(xpToNext(2)).toBe(65);
    expect(xpToNext(10)).toBe(265);
  });
});

describe('addXp', () => {
  it('adds without a level-up', () => {
    expect(addXp(1, 0, 39)).toEqual({ level: 1, xp: 39, levelsGained: [] });
  });

  it('levels up exactly at the threshold', () => {
    expect(addXp(1, 0, 40)).toEqual({ level: 2, xp: 0, levelsGained: [2] });
  });

  it('can gain several levels at once and keeps the remainder', () => {
    // 40 + 65 + 90 = 195 reaches level 4, 5 left over
    expect(addXp(1, 10, 190)).toEqual({ level: 4, xp: 5, levelsGained: [2, 3, 4] });
  });

  it('ignores negative gains', () => {
    expect(addXp(3, 5, -10)).toEqual({ level: 3, xp: 5, levelsGained: [] });
  });
});

describe('levelReward', () => {
  it('is empty for level 1', () => {
    expect(levelReward(1)).toEqual({});
  });

  it('matches the table', () => {
    expect(levelReward(2)).toEqual({ creature: 'puff' });
    expect(levelReward(3)).toEqual({ thirdTeamSlot: true });
    expect(levelReward(4)).toEqual({ shopUnlock: 'frosty', coins: 100 });
    expect(levelReward(5)).toEqual({ dailyTower: true, berries: 10 });
    expect(levelReward(12)).toEqual({ shopUnlock: 'lemon', coins: 300 });
    expect(levelReward(20)).toEqual({ creature: 'rainbow' });
  });

  it('alternates berries and coins on levels 13-19', () => {
    expect(levelReward(13)).toEqual({ berries: 25 });
    expect(levelReward(14)).toEqual({ coins: 400 });
    expect(levelReward(19)).toEqual({ berries: 25 });
  });

  it('gives 200 coins from level 21 on', () => {
    expect(levelReward(21)).toEqual({ coins: 200 });
    expect(levelReward(500)).toEqual({ coins: 200 });
  });
});

describe('xpForRun', () => {
  it('counts layers placed in the run', () => {
    expect(xpForRun(30)).toBe(30);
    expect(xpForRun(45, 20)).toBe(25);
  });

  it('never goes below zero', () => {
    expect(xpForRun(10, 20)).toBe(0);
  });
});
