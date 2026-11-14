import { describe, expect, it } from 'vitest';
import { createDefaultSave } from './defaults';
import { loadSave, serializeSave } from './load';
import { migrate, SaveError, type Migration } from './migrations';
import { MAX_BAKER_LEVEL } from '../../data/progression';
import { xpToNext } from '../progression';
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
    expect(() => migrate({ version: 2 })).toThrow(SaveError);
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

  it('treats a future version as unusable and keeps its text', () => {
    const text = JSON.stringify({ version: 2, coins: 10 });
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

  it('always owns the starter creature and never leaves the team empty', () => {
    const noHoney = load(
      JSON.stringify({ ...fresh(), creatures: { puff: { level: 2 } }, team: ['puff', null, null] }),
    );
    expect(noHoney.save.creatures).toEqual({ puff: { level: 2 }, honey: { level: 1 } });
    expect(noHoney.save.team).toEqual(['puff', null, null]);
    const emptyTeam = load(JSON.stringify({ ...fresh(), team: [null, null, null] }));
    expect(emptyTeam.save.team).toEqual(['honey', null, null]);
  });

  it('clamps baker XP below the next level and the level to the maximum', () => {
    const tampered = load(JSON.stringify({ ...fresh(), bakerLevel: 3, bakerXp: 1e15 })).save;
    expect(tampered.bakerLevel).toBe(3);
    expect(tampered.bakerXp).toBe(xpToNext(3) - 1);
    const huge = load(JSON.stringify({ ...fresh(), bakerLevel: 1e12, bakerXp: 0 })).save;
    expect(huge.bakerLevel).toBe(MAX_BAKER_LEVEL);
  });
});
