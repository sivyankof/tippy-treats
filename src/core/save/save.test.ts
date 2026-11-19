import { describe, expect, it } from 'vitest';
import { createDefaultSave } from './defaults';
import { loadSave, serializeSave } from './load';
import {
  migrate,
  migrateV1,
  migrateV2,
  migrateV3,
  migrateV4,
  migrateV5,
  migrateV6,
  migrateV7,
  migrateV8,
  SaveError,
  type Migration,
} from './migrations';
import { MAX_BAKER_LEVEL } from '../../data/progression/progression';
import { xpToNext } from '../progression/progression';
import { legacyXpToNext, V5_RECORD_UNLOCKS, v5XpToNext } from './frozen-v5';
import { V7_CHECKPOINT_HEIGHTS, v7CheckpointsReached } from './frozen-v7';
import { V8_LAP_LENGTH, V8_SPACE_FIRST_LAYER, v8LapReached } from './frozen-v8';
import { V9_STARTER_PACK_MIN_RUNS } from './frozen-v9';
import { SAVE_VERSION, type Save } from './schema';

const NOW = 1_700_000_000_000;
const makeId = () => 'new-install';
const fresh = () => createDefaultSave(NOW, 'old-install');
const load = (primary: string | null, backup: string | null = null) =>
  loadSave(primary, backup, NOW, makeId);

describe('createDefaultSave', () => {
  it('starts with honey in the first team slot', () => {
    const save = fresh();
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.creatures).toEqual({ honey: { level: 1 } });
    expect(save.team).toEqual(['honey', null, null]);
    expect(save.bakerLevel).toBe(1);
    expect(save.settings.reducedFx).toBe('auto');
    expect(save.installId).toBe('old-install');
    expect(save.createdAt).toBe(NOW);
  });
});

describe('migrate', () => {
  const chain: Record<number, Migration> = {
    1: (raw) => ({ ...raw, coins: raw.gold, gold: undefined }),
    2: (raw) => ({ ...raw, berries: 7 }),
  };

  it('leaves the current version alone', () => {
    const save = fresh();
    expect(migrate(save, NOW)).toEqual(save);
  });

  it('runs every step of the chain in order', () => {
    const result = migrate({ version: 1, gold: 50 }, NOW, chain, 3) as unknown as Record<
      string,
      unknown
    >;
    expect(result.version).toBe(3);
    expect(result.coins).toBe(50);
    expect(result.berries).toBe(7);
  });

  it('starts in the middle of the chain', () => {
    const result = migrate({ version: 2 }, NOW, chain, 3) as unknown as Record<string, unknown>;
    expect(result.berries).toBe(7);
  });

  it('throws a typed error for a future version', () => {
    expect(() => migrate({ version: SAVE_VERSION + 1 }, NOW)).toThrow(SaveError);
    try {
      migrate({ version: 99 }, NOW);
    } catch (error) {
      expect((error as SaveError).code).toBe('future_version');
    }
  });

  it('throws when a step is missing', () => {
    expect(() => migrate({ version: 1 }, NOW, {}, 2)).toThrow(/no migration/);
  });

  it('rejects non-objects and bad versions', () => {
    for (const raw of [null, 5, 'x', [], {}, { version: 'a' }, { version: 0 }, { version: 1.5 }]) {
      expect(() => migrate(raw, NOW)).toThrow(SaveError);
    }
  });
});

describe('loadSave', () => {
  it('makes a new save from empty storage', () => {
    const result = load(null, null);
    expect(result.source).toBe('new');
    expect(result.corrupt).toEqual([]);
    expect(result.save.installId).toBe('new-install');
    expect(load('', '').source).toBe('new');
  });

  it('round-trips a valid save', () => {
    const save = fresh();
    save.coins = 123;
    save.creatures.puff = { level: 3 };
    save.team = ['puff', 'honey', null];
    save.streak.lastDay = '2026-11-14';
    save.missions.items = [{ id: 'm1', group: 'hard', target: 5, progress: 2, claimed: false }];
    save.daily.claimedTiers = [1, 2];
    save.tutorial.hintsShown = ['tap'];
    const result = load(serializeSave(save));
    expect(result.source).toBe('primary');
    expect(result.save).toEqual(save);
  });

  it('treats broken JSON as corrupt and makes a new save', () => {
    const result = load('{"version":1,', null);
    expect(result.source).toBe('new');
    expect(result.corrupt).toEqual([{ key: 'save', text: '{"version":1,' }]);
  });

  it('fills the missing fields of a partial save', () => {
    const result = load(JSON.stringify({ version: 1, coins: 40, settings: { sfx: false } }));
    expect(result.source).toBe('primary');
    expect(result.save.coins).toBe(40);
    expect(result.save.settings.sfx).toBe(false);
    expect(result.save.settings.music).toBe(true);
    expect(result.save.creatures).toEqual({ honey: { level: 1 } });
    expect(result.save.team).toEqual(['honey', null, null]);
    expect(result.save.installId).toBe('new-install');
  });

  it('falls back to defaults for wrong types', () => {
    const result = load(
      JSON.stringify({
        version: 1,
        coins: 'lots',
        berries: null,
        bakerLevel: [],
        creatures: 'none',
        team: 'x',
        records: 5,
        streak: { lastDay: 'yesterday', count: '3' },
        settings: { reducedFx: true, lang: 'fr', music: 'yes', notifications: 1 },
        tutorial: { hintsShown: [1, 'tap', 'tap'] },
        daily: { claimedTiers: 'all' },
        missions: { items: [null, { id: '' }, { id: 'a', group: 'zzz' }] },
      }),
    );
    const save = result.save;
    expect(save.coins).toBe(0);
    expect(save.berries).toBe(0);
    expect(save.bakerLevel).toBe(1);
    expect(save.creatures).toEqual({ honey: { level: 1 } });
    expect(save.team).toEqual(['honey', null, null]);
    expect(save.streak.lastDay).toBe('');
    expect(save.streak.count).toBe(0);
    expect(save.settings.reducedFx).toBe('auto');
    expect(save.settings.lang).toBe('auto');
    expect(save.settings.music).toBe(true);
    expect(save.tutorial.hintsShown).toEqual(['tap']);
    expect(save.daily.claimedTiers).toEqual([]);
    expect(save.missions.items).toEqual([
      { id: 'a', group: 'easy', target: 0, progress: 0, claimed: false },
    ]);
  });

  it('clamps negative and fractional numbers', () => {
    const result = load(
      JSON.stringify({
        version: 1,
        coins: -50,
        berries: 3.9,
        bakerLevel: -2,
        bakerXp: -1,
        stats: { runs: -1 },
        daily: { claimedTiers: [-1, 2, 2, 1.5] },
        creatures: { honey: { level: 99 }, puff: { level: 0 }, jelly: {} },
      }),
    );
    expect(result.save.coins).toBe(0);
    expect(result.save.berries).toBe(3);
    expect(result.save.bakerLevel).toBe(1);
    expect(result.save.bakerXp).toBe(0);
    expect(result.save.stats.runs).toBe(0);
    expect(result.save.daily.claimedTiers).toEqual([2, 1]);
    expect(result.save.creatures).toEqual({
      honey: { level: 5 },
      puff: { level: 1 },
      jelly: { level: 1 },
    });
  });

  it('drops unknown creatures and unowned or repeated team entries', () => {
    const result = load(
      JSON.stringify({
        version: 1,
        creatures: { honey: { level: 2 }, dragon: { level: 1 }, puff: { level: 1 } },
        team: ['dragon', 'puff', 'puff', 'honey'],
      }),
    );
    expect(Object.keys(result.save.creatures).sort()).toEqual(['honey', 'puff']);
    expect(result.save.team).toEqual([null, 'puff', null]);
    const unowned = load(JSON.stringify({ version: 1, team: ['honey', 'ghost', null] }));
    expect(unowned.save.team).toEqual(['honey', null, null]);
  });

  it('keeps a team the player emptied empty', () => {
    const result = load(JSON.stringify({ version: 1, team: [null, null, null] }));
    expect(result.save.team).toEqual([null, null, null]);
  });

  it('treats a future version as unusable and keeps its text', () => {
    const text = JSON.stringify({ version: SAVE_VERSION + 1, coins: 10 });
    const result = load(text);
    expect(result.source).toBe('new');
    expect(result.corrupt).toEqual([{ key: 'save', text }]);
  });

  it('uses the backup when the primary is broken', () => {
    const backup = fresh();
    backup.coins = 77;
    const result = load('garbage', serializeSave(backup));
    expect(result.source).toBe('backup');
    expect(result.save.coins).toBe(77);
    expect(result.corrupt).toEqual([{ key: 'save', text: 'garbage' }]);
  });

  it('uses the backup when there is no primary', () => {
    const result = load(null, serializeSave(fresh()));
    expect(result.source).toBe('backup');
    expect(result.corrupt).toEqual([]);
  });

  it('makes a new save when both are bad', () => {
    const result = load('bad1', 'bad2');
    expect(result.source).toBe('new');
    expect(result.corrupt).toEqual([
      { key: 'save', text: 'bad1' },
      { key: 'backup', text: 'bad2' },
    ]);
    expect(load(null, 'bad2').corrupt).toEqual([{ key: 'backup', text: 'bad2' }]);
  });

  describe('a primary with damaged key fields', () => {
    const damaged = JSON.stringify({ ...fresh(), coins: 'lots', creatures: null });
    const backupText = () => serializeSave({ ...fresh(), coins: 70 });

    it('loses to an intact backup, and is kept as corrupt', () => {
      const result = load(damaged, backupText());
      expect(result.source).toBe('backup');
      expect(result.save.coins).toBe(70);
      expect(result.corrupt).toEqual([{ key: 'save', text: damaged }]);
    });

    it('is repaired field by field when there is no intact backup', () => {
      for (const backup of [null, 'junk', damaged]) {
        const result = load(damaged, backup);
        expect(result.source).toBe('primary');
        expect(result.save.coins).toBe(0);
        expect(result.save.installId).toBe('old-install');
      }
    });

    it('counts a missing stats or records object as damage', () => {
      const noStats: Partial<Save> = fresh();
      delete noStats.stats;
      const result = load(JSON.stringify(noStats), backupText());
      expect(result.source).toBe('backup');
    });
  });

  it('always owns the starter creature', () => {
    const noHoney = load(
      JSON.stringify({ ...fresh(), creatures: { puff: { level: 2 } }, team: ['puff', null, null] }),
    );
    expect(noHoney.save.creatures).toEqual({ puff: { level: 2 }, honey: { level: 1 } });
    expect(noHoney.save.team).toEqual(['puff', null, null]);
  });

  it('clamps baker XP below the next level and the level to the maximum', () => {
    const tampered = load(JSON.stringify({ ...fresh(), bakerLevel: 3, bakerXp: 1e15 })).save;
    expect(tampered.bakerLevel).toBe(3);
    expect(tampered.bakerXp).toBe(xpToNext(3) - 1);
    const huge = load(JSON.stringify({ ...fresh(), bakerLevel: 1e12, bakerXp: 0 })).save;
    expect(huge.bakerLevel).toBe(MAX_BAKER_LEVEL);
  });
});

describe('migration 1 -> 2', () => {
  const v1 = {
    version: 1,
    coins: 120,
    berries: 4,
    bakerLevel: 3,
    bakerXp: 10,
    creatures: { honey: { level: 2 } },
    records: { classicHeight: 33, classicScore: 900, bestCombo: 4 },
    stats: { runs: 5, totalLayers: 80, perfects: 9, adsWatched: 0 },
    streak: { count: 3, best: 4, lastDay: '2026-11-13', cycle: 0, claimedToday: true },
  };

  it('turns the claim flag into the day it belongs to and starts today empty', () => {
    const raw = migrateV1(v1);
    expect(raw.streak).toEqual({
      count: 3,
      best: 4,
      lastDay: '2026-11-13',
      cycle: 0,
      claimedDay: '2026-11-13',
    });
    expect(raw.today).toEqual({ day: '', bestHeight: 0 });
  });

  it('keeps no claim when the flag was off or the streak was missing', () => {
    const off = migrateV1({ ...v1, streak: { ...v1.streak, claimedToday: false } });
    expect((off.streak as Record<string, unknown>).claimedDay).toBe('');
    const none = migrateV1({ version: 1 });
    expect(none.streak).toEqual({ claimedDay: '' });
  });

  it('loads a version 1 text into the current save without losing progress', () => {
    const result = load(JSON.stringify(v1));
    expect(result.source).toBe('primary');
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(120);
    expect(result.save.records.classicHeight).toBe(33);
    expect(result.save.streak).toEqual({
      count: 3,
      best: 4,
      lastDay: '2026-11-13',
      cycle: 0,
      claimedDay: '2026-11-13',
    });
    expect(result.save.today).toEqual({ day: '', bestHeight: 0 });
  });
});

describe('migration 2 to 3', () => {
  const v2 = {
    ...fresh(),
    version: 2,
    ads: { lastInterstitialAt: 5, runsSinceInterstitial: 2, sessions: 4 },
  };

  it('adds an empty offer day and keeps the other counters', () => {
    expect(migrateV2(v2 as unknown as Record<string, unknown>).ads).toEqual({
      lastInterstitialAt: 5,
      runsSinceInterstitial: 2,
      sessions: 4,
      offerDay: '',
    });
    expect(migrateV2({ version: 2 }).ads).toEqual({ offerDay: '' });
  });

  it('loads a version 2 text into the current save without losing progress', () => {
    const result = load(JSON.stringify({ ...v2, coins: 77 }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(77);
    expect(result.save.ads).toEqual({
      lastInterstitialAt: 5,
      runsSinceInterstitial: 2,
      sessions: 4,
      offerDay: '',
      shownDay: '',
      shownToday: 0,
    });
  });

  it('keeps a stored offer day and repairs a bad one', () => {
    const ok = load(serializeSave({ ...fresh(), ads: { ...fresh().ads, offerDay: '2026-11-15' } }));
    expect(ok.save.ads.offerDay).toBe('2026-11-15');
    const bad = load(JSON.stringify({ ...fresh(), ads: { offerDay: 'yesterday' } }));
    expect(bad.save.ads.offerDay).toBe('');
  });
});

describe('migration 3 to 4', () => {
  const v3 = {
    ...fresh(),
    version: 3,
    ads: { lastInterstitialAt: 5, runsSinceInterstitial: 2, sessions: 4, offerDay: '2026-11-14' },
  };

  it('adds an empty daily interstitial count and keeps the other counters', () => {
    expect(migrateV3(v3 as unknown as Record<string, unknown>).ads).toEqual({
      lastInterstitialAt: 5,
      runsSinceInterstitial: 2,
      sessions: 4,
      offerDay: '2026-11-14',
      shownDay: '',
      shownToday: 0,
    });
    expect(migrateV3({ version: 3 }).ads).toEqual({ shownDay: '', shownToday: 0 });
  });

  it('loads a version 3 text into the current save without losing progress', () => {
    const result = load(JSON.stringify({ ...v3, coins: 77 }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(77);
    expect(result.save.ads).toEqual({
      lastInterstitialAt: 5,
      runsSinceInterstitial: 2,
      sessions: 4,
      offerDay: '2026-11-14',
      shownDay: '',
      shownToday: 0,
    });
  });

  it('keeps a stored daily count and repairs a bad one', () => {
    const ads = { ...fresh().ads, shownDay: '2026-11-15', shownToday: 7 };
    const ok = load(serializeSave({ ...fresh(), ads }));
    expect(ok.save.ads).toMatchObject({ shownDay: '2026-11-15', shownToday: 7 });
    const bad = load(JSON.stringify({ ...fresh(), ads: { shownDay: 'today', shownToday: -3 } }));
    expect(bad.save.ads).toMatchObject({ shownDay: '', shownToday: 0 });
  });
});

describe('migration 4 to 5', () => {
  const v4 = { ...fresh(), version: 4 };
  const raw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...v4,
    ...over,
  });

  it('adds an empty oven and an empty x2 counter', () => {
    const next = migrateV4(raw());
    expect(next.oven).toEqual({ day: '', used: 0, carry: 0 });
    expect(next.doubles).toEqual({ day: '', used: 0 });
  });

  it('rescales the XP inside the level in proportion and never lowers a level', () => {
    // Level 3 needed 90 XP before and needs 400 now: 45 / 90 of the bar is 200 / 400.
    const next = migrateV4(raw({ bakerLevel: 3, bakerXp: 45 }));
    expect(next.bakerLevel).toBe(3);
    expect(next.bakerXp).toBe(200);
    // Level 12 needed 315 XP before and needs 100 + 810 * 8 = 6580 now.
    const high = migrateV4(raw({ bakerLevel: 12, bakerXp: 100 }));
    expect(high.bakerXp).toBe(Math.floor((100 / 315) * 6580));
    expect(high.bakerLevel).toBe(12);
  });

  it('uses the frozen numbers of version 5, not the live data', () => {
    expect([1, 2, 3, 4, 5, 12].map(legacyXpToNext)).toEqual([40, 65, 90, 115, 140, 315]);
    expect([1, 2, 3, 4, 5, 12].map(v5XpToNext)).toEqual([150, 250, 400, 600, 910, 6580]);
    expect(V5_RECORD_UNLOCKS).toEqual([{ id: 'twins', height: 75 }]);
  });

  it('keeps an empty bar empty and a full bar below the next level', () => {
    expect(migrateV4(raw({ bakerLevel: 5, bakerXp: 0 })).bakerXp).toBe(0);
    expect(Number(migrateV4(raw({ bakerLevel: 5, bakerXp: 999 })).bakerXp)).toBeLessThan(910);
  });

  it('keeps creature levels, even above the new upgrade gates', () => {
    const creatures = { honey: { level: 5 }, rainbow: { level: 5 } };
    const result = load(JSON.stringify({ ...v4, bakerLevel: 2, creatures }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.bakerLevel).toBe(2);
    expect(result.save.creatures.honey).toEqual({ level: 5 });
    expect(result.save.creatures.rainbow).toEqual({ level: 5 });
  });

  it('loads a version 4 text into the current save without losing progress', () => {
    const result = load(JSON.stringify({ ...v4, coins: 321, bakerLevel: 4, bakerXp: 100 }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(321);
    expect(result.save.bakerLevel).toBe(4);
    // Level 4 needed 115 XP before and needs 600 now.
    expect(result.save.bakerXp).toBe(Math.floor((100 / 115) * 600));
    expect(result.save.oven).toEqual({ day: '', used: 0, carry: 0 });
    expect(result.save.doubles).toEqual({ day: '', used: 0 });
  });

  it('does not invent an XP for a damaged version 4 save, so the intact backup wins', () => {
    const backup = JSON.stringify({ ...v4, coins: 777, bakerLevel: 9, bakerXp: 100 });
    const result = load(JSON.stringify({ ...v4, coins: 5, bakerXp: null }), backup);
    expect(result.source).toBe('backup');
    expect(result.save.coins).toBe(777);
  });

  it('hands over the twins when the old record already reached 75', () => {
    const records = { ...fresh().records, classicHeight: 92 };
    const result = load(JSON.stringify({ ...v4, records }));
    expect(result.save.creatures.twins).toEqual({ level: 1 });
    const low = load(JSON.stringify({ ...v4, records: { ...records, classicHeight: 74 } }));
    expect(low.save.creatures.twins).toBeUndefined();
  });

  it('repairs bad oven and x2 counters and keeps good ones', () => {
    const bad = load(
      JSON.stringify({ ...fresh(), oven: { day: 'x', used: 99_999, carry: 40 }, doubles: 5 }),
    );
    expect(bad.save.oven).toEqual({ day: '', used: 1300, carry: 5 });
    expect(bad.save.doubles).toEqual({ day: '', used: 0 });
    const ok = load(
      serializeSave({
        ...fresh(),
        oven: { day: '2026-11-15', used: 10, carry: 3 },
        doubles: { day: '2026-11-15', used: 2 },
      }),
    );
    expect(ok.save.oven).toEqual({ day: '2026-11-15', used: 10, carry: 3 });
    expect(ok.save.doubles).toEqual({ day: '2026-11-15', used: 2 });
  });
});

describe('migration 5 to 6', () => {
  const v5 = { ...fresh(), version: 5 };

  it('keeps the shown hints and leaves the daily explainer unseen', () => {
    const tutorial = { firstRunDone: true, hintsShown: ['tutorial', 'oven', 'dailyIntro'] };
    const next = migrateV5({ ...v5, tutorial });
    expect(next.tutorial).toEqual({ firstRunDone: true, hintsShown: ['tutorial', 'oven'] });
  });

  it('leaves a damaged hint list to the loader', () => {
    const raw = { ...v5, tutorial: { firstRunDone: true, hintsShown: 'oops' } };
    expect(migrateV5(raw)).toBe(raw);
  });

  it('loads a version 5 text into the current save without losing progress', () => {
    const daily = {
      day: '2026-11-15',
      attemptsUsed: 2,
      extraAttemptUsed: false,
      best: 34,
      claimedTiers: [15, 30],
    };
    const tutorial = { firstRunDone: true, hintsShown: ['tutorial', 'oven'] };
    const result = load(JSON.stringify({ ...v5, coins: 210, bakerLevel: 6, daily, tutorial }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(210);
    expect(result.save.bakerLevel).toBe(6);
    expect(result.save.daily).toEqual(daily);
    expect(result.save.tutorial.hintsShown).toEqual(['tutorial', 'oven']);
  });
});

describe('migration 6 to 7', () => {
  const v6 = { ...fresh(), version: 6 } as Record<string, unknown>;
  delete v6.checkpoints;
  delete v6.checkpointAds;
  const withRecord = (classicHeight: number) => ({
    ...v6,
    records: { classicHeight, classicScore: 900, bestCombo: 7 },
  });

  it('opens the checkpoints the record already reached and starts the ad counter empty', () => {
    const next = migrateV6(withRecord(65));
    expect(next.checkpoints).toEqual([20, 40, 60]);
    expect(next.checkpointAds).toEqual({ day: '', used: 0 });
  });

  it('opens nothing below the first checkpoint and survives a damaged record', () => {
    expect(migrateV6(withRecord(19)).checkpoints).toEqual([]);
    expect(migrateV6({ ...v6, records: 'oops' }).checkpoints).toEqual([]);
    expect(migrateV6({ ...v6, records: { classicHeight: Number.NaN } }).checkpoints).toEqual([]);
  });

  it('uses the frozen heights of version 7, not the live data', () => {
    expect(V7_CHECKPOINT_HEIGHTS).toEqual([20, 40, 60, 80, 100]);
    expect(v7CheckpointsReached(79.9)).toEqual([20, 40, 60]);
  });

  it('loads a version 6 text into the current save without losing progress', () => {
    const result = load(JSON.stringify({ ...withRecord(100), coins: 77 }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(77);
    expect(result.save.records.classicHeight).toBe(100);
    expect(result.save.checkpoints).toEqual([20, 40, 60, 80, 100]);
    expect(result.save.checkpointAds).toEqual({ day: '', used: 0 });
  });

  it('carries a version 1 save through the whole chain', () => {
    const result = load(JSON.stringify({ version: 1, coins: 5, records: { classicHeight: 45 } }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.checkpoints).toEqual([20, 40]);
  });
});

describe('checkpoint fields of the loader', () => {
  const record = (classicHeight: number) => ({ classicHeight, classicScore: 0, bestCombo: 0 });

  it('starts a new save with nothing opened', () => {
    const save = fresh();
    expect(save.checkpoints).toEqual([]);
    expect(save.checkpointAds).toEqual({ day: '', used: 0 });
  });

  it('drops invalid heights, sorts and removes duplicates', () => {
    const raw = { ...fresh(), checkpoints: [40, 'x', 7, 20, 40, null, -20] };
    expect(load(JSON.stringify(raw)).save.checkpoints).toEqual([20, 40]);
  });

  it('derives the list from the record only when the field is missing or invalid', () => {
    const raw = { ...fresh(), records: record(85) };
    const all = [20, 40, 60, 80];
    const noField: Record<string, unknown> = { ...raw };
    delete noField.checkpoints;
    expect(load(JSON.stringify(noField)).save.checkpoints).toEqual(all);
    expect(load(JSON.stringify({ ...raw, checkpoints: 'oops' })).save.checkpoints).toEqual(all);
    // A damaged list (not only checkpoint heights) is derived too, not emptied.
    for (const damaged of [[null], ['20', '40'], [25], [20, 'x']]) {
      expect(load(JSON.stringify({ ...raw, checkpoints: damaged })).save.checkpoints).toEqual(all);
    }
  });

  it('keeps a present list even when the record is higher (it may come from a checkpoint run)', () => {
    const raw = { ...fresh(), records: record(85) };
    expect(load(JSON.stringify({ ...raw, checkpoints: [] })).save.checkpoints).toEqual([]);
    expect(load(JSON.stringify({ ...raw, checkpoints: [20, 40] })).save.checkpoints).toEqual([
      20, 40,
    ]);
  });

  it('keeps the prefix: an opened checkpoint implies the lower ones', () => {
    const raw = { ...fresh(), checkpoints: [60] };
    expect(load(JSON.stringify(raw)).save.checkpoints).toEqual([20, 40, 60]);
  });

  it('keeps an opened checkpoint above a lowered record', () => {
    const raw = { ...fresh(), records: record(10), checkpoints: [20, 40] };
    expect(load(JSON.stringify(raw)).save.checkpoints).toEqual([20, 40]);
  });

  it('repairs the ad counter', () => {
    const bad = load(JSON.stringify({ ...fresh(), checkpointAds: { day: 'x', used: -3 } }));
    expect(bad.save.checkpointAds).toEqual({ day: '', used: 0 });
    const wrong = load(JSON.stringify({ ...fresh(), checkpointAds: 4 }));
    expect(wrong.save.checkpointAds).toEqual({ day: '', used: 0 });
  });

  it('round-trips the checkpoint fields', () => {
    const save: Save = {
      ...fresh(),
      records: record(62),
      checkpoints: [20, 40, 60],
      checkpointAds: { day: '2026-11-15', used: 3 },
    };
    expect(load(serializeSave(save)).save).toEqual(save);
  });
});

describe('migration 7 to 8', () => {
  const v7 = { ...fresh(), version: 7 } as Record<string, unknown>;
  delete v7.bestLap;
  const withRecord = (classicHeight: number) => ({
    ...v7,
    records: { classicHeight, classicScore: 900, bestCombo: 7 },
  });

  it('derives the best lap from the record, so nothing is paid retroactively', () => {
    expect(migrateV7(withRecord(100)).bestLap).toBe(0);
    expect(migrateV7(withRecord(101)).bestLap).toBe(1);
    expect(migrateV7(withRecord(120)).bestLap).toBe(1);
    expect(migrateV7(withRecord(121)).bestLap).toBe(2);
    expect(migrateV7(withRecord(300)).bestLap).toBe(10);
  });

  it('survives a damaged record', () => {
    expect(migrateV7({ ...v7, records: 'oops' }).bestLap).toBe(0);
    expect(migrateV7(withRecord(Number.NaN)).bestLap).toBe(0);
  });

  it('uses the frozen lap rules of version 8, not the live data', () => {
    expect(V8_SPACE_FIRST_LAYER).toBe(101);
    expect(V8_LAP_LENGTH).toBe(20);
    expect(v8LapReached(140.9)).toBe(2);
  });

  it('loads a version 7 text into the current save without losing progress', () => {
    const result = load(JSON.stringify({ ...withRecord(145), coins: 55 }));
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(55);
    expect(result.save.bestLap).toBe(3);
  });

  it('carries a version 1 save through the whole chain', () => {
    const result = load(JSON.stringify({ version: 1, records: { classicHeight: 125 } }));
    expect(result.save.bestLap).toBe(2);
  });
});

describe('best lap of the loader', () => {
  it('starts a new save at 0 and keeps a valid value', () => {
    expect(fresh().bestLap).toBe(0);
    expect(load(JSON.stringify({ ...fresh(), bestLap: 4 })).save.bestLap).toBe(4);
  });

  it('derives a missing or damaged value from the record', () => {
    const records = { classicHeight: 130, classicScore: 0, bestCombo: 0 };
    const noField: Record<string, unknown> = { ...fresh(), records };
    delete noField.bestLap;
    expect(load(JSON.stringify(noField)).save.bestLap).toBe(2);
    expect(load(JSON.stringify({ ...noField, bestLap: 'x' })).save.bestLap).toBe(2);
  });
});

describe('migration 8 to 9', () => {
  const LATER = NOW + 5 * 86_400_000;
  // The version 8 shape of the shop: no first show of the starter pack yet.
  const v8 = {
    ...fresh(),
    version: 8,
    shop: { freeCoinsDay: '2026-11-01', freeCoinsUsed: 2, starterPackUntil: 0 },
  } as Record<string, unknown>;
  const withRuns = (runs: number, bought = false) => ({
    ...v8,
    stats: { runs, totalLayers: 300, perfects: 40, adsWatched: 3 },
    purchases: { removeAds: false, starterPack: bought },
  });
  const shownAt = (raw: Record<string, unknown>) =>
    (migrateV8(raw, LATER).shop as Record<string, unknown>).starterPackShownAt;

  it('starts the window now for a player who has the runs and has not bought the pack', () => {
    expect(shownAt(withRuns(10))).toBe(LATER);
    expect(shownAt(withRuns(250))).toBe(LATER);
  });

  it('leaves the first show empty below 10 runs or when the pack is bought', () => {
    expect(shownAt(withRuns(9))).toBe(0);
    expect(shownAt(withRuns(0))).toBe(0);
    expect(shownAt(withRuns(10, true))).toBe(0);
    expect(shownAt(withRuns(9, true))).toBe(0);
  });

  it('keeps the rest of the shop and survives damaged fields', () => {
    expect(migrateV8(withRuns(12), LATER).shop).toEqual({
      freeCoinsDay: '2026-11-01',
      freeCoinsUsed: 2,
      starterPackUntil: 0,
      starterPackShownAt: LATER,
    });
    expect(shownAt({ ...v8, stats: 'oops', shop: 'oops' })).toBe(0);
    expect(shownAt({ ...v8, stats: { runs: Number.NaN } })).toBe(0);
  });

  it('uses the frozen run count of version 9, not the live data', () => {
    expect(V9_STARTER_PACK_MIN_RUNS).toBe(10);
  });

  it('loads a version 8 text with the time of the load', () => {
    const result = loadSave(JSON.stringify({ ...withRuns(11), coins: 33 }), null, LATER, makeId);
    expect(result.save.version).toBe(SAVE_VERSION);
    expect(result.save.coins).toBe(33);
    expect(result.save.shop.starterPackShownAt).toBe(LATER);
    expect(load(JSON.stringify(withRuns(3))).save.shop.starterPackShownAt).toBe(0);
  });

  it('carries a version 1 save through the whole chain', () => {
    const result = load(JSON.stringify({ version: 1, stats: { runs: 40 } }));
    expect(result.save.shop.starterPackShownAt).toBe(NOW);
  });

  it('keeps a stored first show and repairs a damaged one', () => {
    const shop = { ...fresh().shop, starterPackShownAt: NOW - 1000 };
    expect(load(JSON.stringify({ ...fresh(), shop })).save.shop.starterPackShownAt).toBe(
      NOW - 1000,
    );
    const bad = { ...fresh(), shop: { ...shop, starterPackShownAt: 'x' } };
    expect(load(JSON.stringify(bad)).save.shop.starterPackShownAt).toBe(0);
  });
});
