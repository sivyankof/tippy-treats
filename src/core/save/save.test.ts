import { describe, expect, it } from 'vitest';
import { createDefaultSave } from './defaults';
import { loadSave, serializeSave } from './load';
import {
  migrate,
  migrateV1,
  migrateV2,
  migrateV3,
  migrateV4,
  SaveError,
  type Migration,
} from './migrations';
import { MAX_BAKER_LEVEL } from '../../data/progression';
import { xpToNext } from '../progression';
import { legacyXpToNext, V5_RECORD_UNLOCKS, v5XpToNext } from './frozen-v5';
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
    expect(migrate(save)).toEqual(save);
  });

  it('runs every step of the chain in order', () => {
    const result = migrate({ version: 1, gold: 50 }, chain, 3) as unknown as Record<
      string,
      unknown
    >;
    expect(result.version).toBe(3);
    expect(result.coins).toBe(50);
    expect(result.berries).toBe(7);
  });

  it('starts in the middle of the chain', () => {
    const result = migrate({ version: 2 }, chain, 3) as unknown as Record<string, unknown>;
    expect(result.berries).toBe(7);
  });

  it('throws a typed error for a future version', () => {
    expect(() => migrate({ version: SAVE_VERSION + 1 })).toThrow(SaveError);
    try {
      migrate({ version: 99 });
    } catch (error) {
      expect((error as SaveError).code).toBe('future_version');
    }
  });

  it('throws when a step is missing', () => {
    expect(() => migrate({ version: 1 }, {}, 2)).toThrow(/no migration/);
  });

  it('rejects non-objects and bad versions', () => {
    for (const raw of [null, 5, 'x', [], {}, { version: 'a' }, { version: 0 }, { version: 1.5 }]) {
      expect(() => migrate(raw)).toThrow(SaveError);
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
