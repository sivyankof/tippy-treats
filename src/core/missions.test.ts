import { describe, expect, it } from 'vitest';
import { MISSION_POOL, MISSIONS } from '../data/missions';
import { dailyUnlockLevel } from './daily';
import {
  applyRunStats,
  claimChest,
  claimableCount,
  claimMission,
  closestMission,
  isComplete,
  missionsForDay,
  missionTemplate,
  pickMissions,
  rerollMission,
  seedFromText,
  share,
} from './missions';
import type { Missions, RunStats } from './missions';
import type { MissionProgress } from './save/schema';

/** A baker level far above the daily tower unlock. */
const OPEN = 99;

const at = <T>(values: readonly T[], index: number): T => {
  const value = values[index];
  if (value === undefined) throw new Error(`no value at ${index}`);
  return value;
};

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  mode: 'classic',
  height: 0,
  score: 0,
  bestCombo: 0,
  perfects: 0,
  floatingCoins: 0,
  abilities: 0,
  maxWobble: 0,
  coins: 0,
  ...over,
});

const item = (id: string, over: Partial<MissionProgress> = {}): MissionProgress => {
  const template = missionTemplate(id);
  if (!template) throw new Error(id);
  return {
    id,
    group: template.group,
    target: template.kind === 'height' ? 20 : template.target,
    progress: 0,
    claimed: false,
    ...over,
  };
};

const list = (items: MissionProgress[], over: Partial<Missions> = {}): Missions => ({
  day: '2026-11-14',
  items,
  rerollUsed: false,
  chestClaimed: false,
  ...over,
});

describe('pool', () => {
  it('has 6 easy, 8 medium, 6 hard templates with unique ids', () => {
    const count = (g: string) => MISSION_POOL.filter((t) => t.group === g).length;
    expect([count('easy'), count('medium'), count('hard')]).toEqual([6, 8, 6]);
    expect(new Set(MISSION_POOL.map((t) => t.id)).size).toBe(MISSION_POOL.length);
  });
});

describe('seedFromText', () => {
  it('is stable and differs by text', () => {
    expect(seedFromText('a')).toBe(seedFromText('a'));
    expect(seedFromText('a')).not.toBe(seedFromText('b'));
    expect(seedFromText('')).toBeGreaterThanOrEqual(0);
  });
});

describe('pickMissions', () => {
  it('deals one mission per group, deterministically', () => {
    const a = pickMissions('2026-11-14', 'install-1', 40, OPEN);
    expect(a.map((m) => m.group)).toEqual(['easy', 'medium', 'hard']);
    expect(pickMissions('2026-11-14', 'install-1', 40, OPEN)).toEqual(a);
    expect(a.every((m) => m.progress === 0 && !m.claimed)).toBe(true);
  });

  it('varies over days', () => {
    const ids = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      const day = `2026-12-${String(d).padStart(2, '0')}`;
      ids.add(
        pickMissions(day, 'x', 0, OPEN)
          .map((m) => m.id)
          .join(),
      );
    }
    expect(ids.size).toBeGreaterThan(5);
  });

  it('varies over installs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(
        pickMissions('2026-11-14', `inst-${i}`, 0, OPEN)
          .map((m) => m.id)
          .join(),
      );
    }
    expect(ids.size).toBeGreaterThan(3);
  });

  it('never deals the daily tower mission while the tower is locked', () => {
    const locked = dailyUnlockLevel() - 1;
    for (let d = 1; d <= 120; d++) {
      const day = `2027-03-${d}`;
      expect(pickMissions(day, 'i', 0, locked).some((m) => m.id === 'daily_play_1')).toBe(false);
    }
  });

  it('can deal the daily tower mission once the tower is open', () => {
    const dealt = Array.from({ length: 120 }, (_, d) => pickMissions(`2027-03-${d}`, 'i', 0, OPEN));
    expect(dealt.some((list) => list.some((m) => m.id === 'daily_play_1'))).toBe(true);
  });

  it('scales height targets by the record and clamps them', () => {
    const find = (record: number, id: string): number | undefined => {
      for (let d = 1; d < 400; d++) {
        const hit = pickMissions(`2027-01-${d}`, 'i', record, OPEN).find((m) => m.id === id);
        if (hit) return hit.target;
      }
      return undefined;
    };
    expect(find(0, 'height_half')).toBe(10);
    expect(find(50, 'height_half')).toBe(25);
    expect(find(500, 'height_half')).toBe(40);
    expect(find(0, 'height_high')).toBe(20);
    expect(find(50, 'height_high')).toBe(40);
    expect(find(500, 'height_high')).toBe(70);
  });
});

describe('missionsForDay', () => {
  const current = list([item('runs_3', { progress: 2 }), item('combo_5'), item('combo_8')]);

  it('keeps the list on the same day', () => {
    expect(missionsForDay(current, '2026-11-14', 'i', 0, OPEN, false)).toBe(current);
  });

  it('keeps the list when the day is earlier than the list and the clock flag is off', () => {
    const used = { ...current, rerollUsed: true, chestClaimed: true };
    expect(missionsForDay(used, '2026-11-13', 'i', 0, OPEN, false)).toBe(used);
    expect(missionsForDay(used, '2026-10-31', 'i', 0, OPEN, false)).toBe(used);
  });

  it('deals a new list on a new day and resets flags', () => {
    const old = { ...current, rerollUsed: true, chestClaimed: true };
    const next = missionsForDay(old, '2026-11-15', 'i', 0, OPEN, false);
    expect(next.day).toBe('2026-11-15');
    expect(next.rerollUsed).toBe(false);
    expect(next.chestClaimed).toBe(false);
    expect(next.items).toEqual(pickMissions('2026-11-15', 'i', 0, OPEN));
  });

  it('handles several missed days and month and year boundaries', () => {
    expect(missionsForDay(current, '2026-11-30', 'i', 0, OPEN, false).day).toBe('2026-11-30');
    expect(missionsForDay(current, '2026-12-01', 'i', 0, OPEN, false).day).toBe('2026-12-01');
    expect(missionsForDay(current, '2027-01-01', 'i', 0, OPEN, false).day).toBe('2027-01-01');
  });

  it('keeps the list when the clock went back', () => {
    expect(missionsForDay(current, '2026-11-10', 'i', 0, OPEN, true)).toBe(current);
  });

  it('deals a list for a new player with empty fields', () => {
    const empty: Missions = { day: '', items: [], rerollUsed: false, chestClaimed: false };
    expect(missionsForDay(empty, '2026-11-14', 'i', 0, OPEN, false).items).toHaveLength(3);
    expect(missionsForDay(empty, '2026-11-14', 'i', 0, OPEN, true).items).toHaveLength(3);
  });
});

describe('applyRunStats', () => {
  it('adds totals and caps at the target', () => {
    const [a, b] = applyRunStats(
      [item('runs_3', { progress: 2 }), item('perfects_10', { progress: 8 })],
      stats({ perfects: 5 }),
    );
    expect(a?.progress).toBe(3);
    expect(b?.progress).toBe(10);
  });

  it('takes the maximum for in-one-run kinds', () => {
    const out = applyRunStats(
      [
        item('combo_5', { progress: 3 }),
        item('score_3000', { progress: 2000 }),
        item('abilities_run_3', { progress: 2 }),
        item('height_half', { progress: 12 }),
      ],
      stats({ bestCombo: 2, score: 2500, abilities: 1, height: 15 }),
    );
    expect(out.map((m) => m.progress)).toEqual([3, 2500, 2, 15]);
  });

  it('counts totals: floating coins, abilities, coins', () => {
    const out = applyRunStats(
      [item('floating_coins_15'), item('abilities_3'), item('coins_150')],
      stats({ floatingCoins: 4, abilities: 2, coins: 60 }),
    );
    expect(out.map((m) => m.progress)).toEqual([4, 2, 60]);
  });

  it('counts the daily tower only in daily mode', () => {
    expect(at(applyRunStats([item('daily_play_1')], stats()), 0).progress).toBe(0);
    expect(at(applyRunStats([item('daily_play_1')], stats({ mode: 'daily' })), 0).progress).toBe(1);
  });

  it('counts a calm run only when the wobble stayed below the limit', () => {
    const calm = applyRunStats([item('calm_run_15')], stats({ height: 20, maxWobble: 49 }));
    expect(at(calm, 0).progress).toBe(15);
    const wild = applyRunStats(
      [item('calm_run_15')],
      stats({ height: 20, maxWobble: MISSIONS.calmWobble }),
    );
    expect(at(wild, 0).progress).toBe(0);
  });

  it('leaves claimed items and unknown ids alone and does not mutate', () => {
    const claimed = item('runs_3', { progress: 3, claimed: true });
    const unknown: MissionProgress = {
      id: 'gone',
      group: 'easy',
      target: 3,
      progress: 1,
      claimed: false,
    };
    const input = [claimed, unknown];
    const out = applyRunStats(input, stats({ perfects: 9 }));
    expect(at(out, 0)).toBe(claimed);
    expect(at(out, 1)).toBe(unknown);
    expect(input).toEqual([claimed, unknown]);
  });
});

describe('claimMission', () => {
  it('pays by group and marks claimed', () => {
    const m = list([
      item('runs_3', { progress: 3 }),
      item('combo_5', { progress: 5 }),
      item('combo_8', { progress: 8 }),
    ]);
    expect([0, 1, 2].map((i) => claimMission(m, i).coins)).toEqual([40, 80, 150]);
    expect(at(claimMission(m, 0).missions.items, 0).claimed).toBe(true);
    expect(at(m.items, 0).claimed).toBe(false);
  });

  it('refuses incomplete, claimed or missing missions', () => {
    const m = list([
      item('runs_3', { progress: 1 }),
      item('combo_5', { progress: 5, claimed: true }),
    ]);
    expect(claimMission(m, 0)).toEqual({ missions: m, coins: 0 });
    expect(claimMission(m, 1).coins).toBe(0);
    expect(claimMission(m, 7).coins).toBe(0);
  });
});

describe('rerollMission', () => {
  const m = list([item('runs_3'), item('combo_5'), item('combo_8')]);

  it('replaces with another template of the same group, deterministically', () => {
    const a = rerollMission(m, 1, '2026-11-14', 'i', 0, OPEN);
    expect(a.rerollUsed).toBe(true);
    expect(at(a.items, 1).id).not.toBe('combo_5');
    expect(at(a.items, 1).group).toBe('medium');
    expect(at(a.items, 1).progress).toBe(0);
    expect(rerollMission(m, 1, '2026-11-14', 'i', 0, OPEN)).toEqual(a);
    expect(at(a.items, 0)).toBe(at(m.items, 0));
  });

  it('never picks a template already in the list', () => {
    for (let d = 1; d <= 30; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      expect(at(rerollMission(m, 0, day, 'i', 0, OPEN).items, 0).id).not.toBe('runs_3');
    }
  });

  it('is allowed once a day and not for completed or claimed missions', () => {
    const used = { ...m, rerollUsed: true };
    expect(rerollMission(used, 1, 'd', 'i', 0, OPEN)).toBe(used);
    const done = list([
      item('runs_3', { progress: 3 }),
      item('combo_5', { claimed: true, progress: 5 }),
    ]);
    expect(rerollMission(done, 0, 'd', 'i', 0, OPEN)).toBe(done);
    expect(rerollMission(done, 1, 'd', 'i', 0, OPEN)).toBe(done);
    expect(rerollMission(m, 5, 'd', 'i', 0, OPEN)).toBe(m);
  });

  it('never rerolls into the daily tower mission while the tower is locked', () => {
    const locked = dailyUnlockLevel() - 1;
    const start = list([item('runs_3'), item('combo_5'), item('combo_8')]);
    for (let d = 1; d <= 120; d++) {
      const out = rerollMission(start, 1, `2027-04-${d}`, 'i', 0, locked);
      expect(at(out.items, 1).id).not.toBe('daily_play_1');
    }
  });

  it('scales a rerolled height mission by the record', () => {
    const start = list([item('runs_3'), item('score_3000'), item('combo_8')]);
    for (let d = 1; d <= 60; d++) {
      const out = rerollMission(start, 1, `2027-02-${d}`, 'i', 50, OPEN);
      if (at(out.items, 1).id === 'height_half') {
        expect(at(out.items, 1).target).toBe(25);
        return;
      }
    }
    throw new Error('height_half never drawn');
  });
});

describe('claimChest', () => {
  const claimed = (): Missions =>
    list([
      item('runs_3', { progress: 3, claimed: true }),
      item('combo_5', { progress: 5, claimed: true }),
      item('combo_8', { progress: 8, claimed: true }),
    ]);

  it('pays berries once when all are claimed', () => {
    const out = claimChest(claimed());
    expect(out.berries).toBe(MISSIONS.chestBerries);
    expect(out.missions.chestClaimed).toBe(true);
    expect(claimChest(out.missions).berries).toBe(0);
  });

  it('pays nothing while one is open or the list is empty', () => {
    const open = claimed();
    open.items[2] = item('combo_8', { progress: 8 });
    expect(claimChest(open).berries).toBe(0);
    expect(claimChest(list([])).berries).toBe(0);
  });
});

describe('helpers', () => {
  it('isComplete and claimableCount', () => {
    const m = list([
      item('runs_3', { progress: 3 }),
      item('combo_5', { progress: 5, claimed: true }),
      item('combo_8'),
    ]);
    expect(isComplete(at(m.items, 0))).toBe(true);
    expect(claimableCount(m)).toBe(1);
  });

  it('missionTemplate finds by id', () => {
    expect(missionTemplate('runs_3')?.kind).toBe('runs');
    expect(missionTemplate('nope')).toBeUndefined();
  });

  it('closestMission picks the highest share at 70% or more', () => {
    const items = [
      item('runs_5', { progress: 4 }),
      item('combo_5', { progress: 4 }),
      item('combo_8', { progress: 5 }),
    ];
    expect(closestMission(items)?.id).toBe('runs_5');
    expect(closestMission([item('runs_5', { progress: 3 })])).toBeUndefined();
    expect(closestMission([item('runs_3', { progress: 3 })])).toBeUndefined();
    expect(closestMission([item('runs_5', { progress: 4, claimed: true })])).toBeUndefined();
    expect(closestMission([item('combo_8', { progress: 6 })])?.id).toBe('combo_8');
  });
});

describe('share', () => {
  it('keeps the share within 0..1', () => {
    expect(share(item('runs_3', { progress: 1, target: 2 }))).toBe(0.5);
    expect(share(item('runs_3', { progress: 15, target: 10 }))).toBe(1);
    expect(share(item('runs_3', { progress: 0, target: 0 }))).toBe(1);
  });
});
