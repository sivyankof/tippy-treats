import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../save/defaults';
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_MAX,
  ACHIEVEMENT_POINT_CAP,
  ACHIEVEMENT_POINTS_MAX,
  CREW_ALL_1_1,
} from '../../data/games/achievements';
import { CREATURE_IDS } from '../../data/creatures/creatures';
import { achievementPercents, counterValue, percentOf, risenAchievements } from './achievements';

const fresh = () => createDefaultSave(0, 'test');

function percentById(save: ReturnType<typeof fresh>): Map<string, number> {
  return new Map(achievementPercents(save).map((a) => [a.id, a.percent]));
}

describe('achievement list', () => {
  it('has 29 achievements with unique ids within the Game Center limits', () => {
    expect(ACHIEVEMENTS).toHaveLength(29);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(ACHIEVEMENTS_MAX);
    const total = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);
    expect(total).toBeLessThanOrEqual(ACHIEVEMENT_POINTS_MAX);
    for (const a of ACHIEVEMENTS) {
      expect(a.points).toBeGreaterThan(0);
      expect(a.points).toBeLessThanOrEqual(ACHIEVEMENT_POINT_CAP);
      expect(a.id).toMatch(/^[a-z0-9_]{1,100}$/);
    }
  });

  it('makes a higher tier of a row harder and worth more', () => {
    const rows = new Map<string, typeof ACHIEVEMENTS>();
    for (const a of ACHIEVEMENTS) {
      const row = a.id.replace(/_\d+$/, '');
      rows.set(row, [...(rows.get(row) ?? []), a]);
    }
    for (const [row, items] of rows) {
      if (row === 'height' || row === 'lap') continue;
      for (let i = 1; i < items.length; i++) {
        expect(items[i]!.target).toBeGreaterThan(items[i - 1]!.target);
        expect(items[i]!.points).toBeGreaterThan(items[i - 1]!.points);
      }
    }
  });

  it('keeps the owner thresholds of the flies and the 1.1 crew number', () => {
    const targets = ACHIEVEMENTS.filter((a) => a.counter === 'flies').map((a) => a.target);
    expect(targets).toEqual([50, 500, 1000]);
    expect(CREW_ALL_1_1).toBe(CREATURE_IDS.length);
  });
});

describe('percentOf', () => {
  it('rounds down to whole percent and stops at 100', () => {
    expect(percentOf(0, 50)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(49, 50)).toBe(98);
    expect(percentOf(50, 50)).toBe(100);
    expect(percentOf(5000, 50)).toBe(100);
  });

  it('gives 0 for nonsense input', () => {
    expect(percentOf(-5, 50)).toBe(0);
    expect(percentOf(Number.NaN, 50)).toBe(0);
    expect(percentOf(10, 0)).toBe(0);
  });
});

describe('achievementPercents', () => {
  it('is all zero for a fresh save except what a fresh save already has', () => {
    const save = fresh();
    const owned = counterValue(save, 'creatures');
    for (const a of achievementPercents(save)) {
      const def = ACHIEVEMENTS.find((d) => d.id === a.id)!;
      if (def.counter === 'creatures') expect(a.percent).toBe(percentOf(owned, def.target));
      else expect(a.percent).toBe(0);
    }
  });

  it('reads every counter from its own field', () => {
    const save = fresh();
    save.stats.flies = 250;
    save.stats.perfects = 1000;
    save.stats.runs = 10;
    save.stats.totalLayers = 2500;
    save.records.bestCombo = 15;
    save.streak.best = 7;
    save.records.dailyBest = 75;
    save.records.classicHeight = 47;
    save.bestLap = 2;
    const p = percentById(save);
    expect(p.get('flies_1')).toBe(100);
    expect(p.get('flies_2')).toBe(50);
    expect(p.get('flies_3')).toBe(25);
    expect(p.get('perfects_2')).toBe(100);
    expect(p.get('runs_1')).toBe(100);
    expect(p.get('runs_2')).toBe(10);
    expect(p.get('layers_2')).toBe(50);
    expect(p.get('combo_1')).toBe(100);
    expect(p.get('combo_2')).toBe(75);
    expect(p.get('streak_1')).toBe(100);
    expect(p.get('streak_2')).toBe(23);
    expect(p.get('daily_1')).toBe(100);
    expect(p.get('daily_2')).toBe(75);
    expect(p.get('height_40')).toBe(100);
    expect(p.get('height_60')).toBe(78);
    expect(p.get('lap_3')).toBe(66);
  });

  it('counts the daily tower by the best of all time, not by the day', () => {
    const save = fresh();
    save.daily.best = 100;
    save.records.dailyBest = 40;
    expect(percentById(save).get('daily_2')).toBe(40);
  });

  it('counts owned creatures and those at level 5 against the fixed 1.1 number', () => {
    const save = fresh();
    save.creatures = {};
    CREATURE_IDS.slice(0, 6).forEach((id, i) => {
      save.creatures[id] = { level: i === 0 ? 5 : 2 };
    });
    const p = percentById(save);
    expect(p.get('creatures_1')).toBe(100);
    expect(p.get('creatures_2')).toBe(50);
    expect(p.get('masters_1')).toBe(100);
    expect(p.get('masters_2')).toBe(8);
  });
});

describe('risenAchievements', () => {
  it('keeps only what grew past the last report', () => {
    const reported = new Map([
      ['a', 50],
      ['b', 100],
    ]);
    const current = [
      { id: 'a', percent: 60 },
      { id: 'b', percent: 100 },
      { id: 'c', percent: 0 },
      { id: 'd', percent: 5 },
    ];
    expect(risenAchievements(current, reported)).toEqual([
      { id: 'a', percent: 60 },
      { id: 'd', percent: 5 },
    ]);
  });

  it('never sends a lower percent (after a reset of the progress)', () => {
    expect(risenAchievements([{ id: 'a', percent: 10 }], new Map([['a', 80]]))).toEqual([]);
  });
});
