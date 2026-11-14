import { afterEach, describe, expect, it } from 'vitest';
import { emptyTally } from '../../../core/run-tally';
import { setLang, t } from '../../../i18n';
import type { LevelUp } from '../../../state/game-state';
import { coinLines, nearMissText, newCreaturesOf, rewardLines, xpSegments } from './results-text';

afterEach(() => setLang('en'));

describe('coin breakdown', () => {
  it('lists the sources that paid, in a fixed order', () => {
    const tally = emptyTally();
    tally.coins.height = 12;
    tally.coins.floating = 5;
    expect(coinLines(tally)).toEqual([
      { source: 'floating', amount: 5 },
      { source: 'height', amount: 12 },
    ]);
  });

  it('is empty when nothing was earned', () => {
    expect(coinLines(emptyTally())).toEqual([]);
  });
});

describe('near miss text', () => {
  it('uses the plural forms and the creature name', () => {
    expect(nearMissText({ kind: 'record', layers: 1 })).toBe('Only 1 layer to your record!');
    expect(nearMissText({ kind: 'record', layers: 4 })).toBe('Only 4 layers to your record!');
    expect(nearMissText({ kind: 'xp', xp: 12, level: 5 })).toBe('12 XP to level 5');
    expect(nearMissText({ kind: 'mission', id: 'score_3000', target: 3000, remaining: 400 })).toBe(
      '400 more for the mission: Score 3,000 in one run',
    );
    expect(nearMissText({ kind: 'coins', coins: 40, creature: 'jelly' })).toBe(
      `Just 40 coins to buy ${t('creature.jelly.name')}`,
    );
    expect(nearMissText({ kind: 'best', record: 31, today: 12 })).toBe('Record: 31 · today: 12');
  });

  it('speaks Russian too', () => {
    setLang('ru');
    expect(nearMissText({ kind: 'best', record: 31, today: 12 })).toBe('Рекорд: 31 · сегодня: 12');
  });
});

describe('level-up lines', () => {
  const up = (over: Partial<LevelUp>): LevelUp => ({
    level: 4,
    reward: {},
    duplicate: null,
    ...over,
  });

  it('makes a line per reward', () => {
    expect(rewardLines(up({ reward: { shopUnlock: 'frosty', coins: 100 } }))).toEqual([
      { kind: 'shop', id: 'frosty' },
      { kind: 'gain', currency: 'coins', amount: 100 },
    ]);
    expect(rewardLines(up({ reward: { dailyTower: true, berries: 10 } }))).toEqual([
      { kind: 'daily' },
      { kind: 'gain', currency: 'berries', amount: 10 },
    ]);
    expect(rewardLines(up({ reward: { thirdTeamSlot: true } }))).toEqual([{ kind: 'slot' }]);
  });

  it('shows what a creature already owned paid instead', () => {
    const lines = rewardLines(up({ reward: { creature: 'puff' }, duplicate: { coins: 150 } }));
    expect(lines).toEqual([
      { kind: 'creature', id: 'puff', instead: [{ currency: 'coins', amount: 150 }] },
    ]);
    expect(rewardLines(up({ reward: { creature: 'puff' } }))).toEqual([
      { kind: 'creature', id: 'puff', instead: [] },
    ]);
  });

  it('presents only new creatures', () => {
    const list = [
      up({ level: 2, reward: { creature: 'puff' } }),
      up({ level: 20, reward: { creature: 'rainbow' }, duplicate: { berries: 300 } }),
      up({ level: 3, reward: { thirdTeamSlot: true } }),
    ];
    expect(newCreaturesOf(list)).toEqual(['puff']);
  });
});

describe('xp segments', () => {
  it('is one piece inside a level', () => {
    expect(xpSegments(3.2, 3.7)).toEqual([{ from: 3.2, to: 3.7, reaches: null }]);
  });

  it('splits at every whole level', () => {
    expect(xpSegments(3.5, 5.25)).toEqual([
      { from: 3.5, to: 4, reaches: 4 },
      { from: 4, to: 5, reaches: 5 },
      { from: 5, to: 5.25, reaches: null },
    ]);
  });

  it('ends on a level-up that lands exactly on a whole level', () => {
    expect(xpSegments(3.5, 4)).toEqual([{ from: 3.5, to: 4, reaches: 4 }]);
  });

  it('is empty when nothing was gained', () => {
    expect(xpSegments(3.5, 3.5)).toEqual([]);
  });
});
