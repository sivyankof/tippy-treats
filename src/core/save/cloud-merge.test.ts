import { describe, expect, it } from 'vitest';
import { CLOUD } from '../../data/app/cloud';
import {
  almostEmpty,
  decide,
  firstWriteDue,
  nextCopy,
  readCloudText,
  serializeCopy,
  type CloudCopy,
  type UsableCloud,
} from './cloud-merge';
import { createDefaultSave } from './defaults';
import { SAVE_VERSION, type Save } from './schema';

const T0 = Date.UTC(2026, 10, 1, 12, 0, 0);

/** A player with some progress who last synced copy `cloudId` number `cloudRev`. */
function local(sync: Partial<Save['sync']> = {}, over: Partial<Save> = {}): Save {
  const base = createDefaultSave(T0, 'device-a');
  return {
    ...base,
    bakerLevel: 7,
    coins: 900,
    stats: { ...base.stats, runs: 40 },
    sync: { cloudRev: 3, cloudId: 'c3', dirty: false, ...sync },
    ...over,
  };
}

/** A copy of another device's progress. */
function copy(over: Partial<CloudCopy> = {}): CloudCopy {
  const save = { ...createDefaultSave(T0, 'device-b'), bakerLevel: 9, coins: 4000 };
  return {
    rev: 4,
    id: 'c4',
    lineage: ['c1', 'c2', 'c3'],
    writer: 'device-b',
    savedAt: T0,
    save,
    ...over,
  };
}

const inCloud = (c: CloudCopy): UsableCloud => ({ kind: 'copy', copy: c });
const EMPTY: UsableCloud = { kind: 'empty' };

/** The save of `c` as a version 10 save (before `prevDay`, `sync`, `flies`, `dailyBest`). */
function asV10(save: Save): Record<string, unknown> {
  const raw: Record<string, unknown> = { ...save, version: 10 };
  delete raw.prevDay;
  delete raw.sync;
  return raw;
}

/** A brand-new device: never synced, nothing played. */
function fresh(over: Partial<Save> = {}): Save {
  return { ...createDefaultSave(T0, 'device-new'), ...over };
}

describe('readCloudText', () => {
  it('reads nothing as an empty cloud', () => {
    expect(readCloudText(null, T0)).toEqual({ kind: 'empty' });
    expect(readCloudText('', T0)).toEqual({ kind: 'empty' });
  });

  it('reads back a copy it wrote', () => {
    const written = copy();
    const read = readCloudText(serializeCopy(written), T0);
    expect(read.kind).toBe('copy');
    if (read.kind !== 'copy') return;
    expect(read.copy).toMatchObject({
      rev: 4,
      id: 'c4',
      lineage: ['c1', 'c2', 'c3'],
      writer: 'device-b',
    });
    expect(read.copy.save.bakerLevel).toBe(9);
    expect(read.copy.save.coins).toBe(4000);
  });

  it('migrates a copy of an older game version', () => {
    const v10 = {
      ...asV10(copy().save),
      stats: { runs: 12, totalLayers: 300, perfects: 20, adsWatched: 1 },
      records: { classicHeight: 55, classicScore: 900, bestCombo: 6 },
      daily: { ...copy().save.daily, best: 31 },
    };
    const read = readCloudText(JSON.stringify({ ...copy(), save: v10 }), T0);
    expect(read.kind).toBe('copy');
    if (read.kind !== 'copy') return;
    expect(read.copy.save.version).toBe(SAVE_VERSION);
    expect(read.copy.save.stats.flies).toBe(0);
    expect(read.copy.save.records.dailyBest).toBe(31);
    expect(read.copy.save.stats.runs).toBe(12);
  });

  it('reads a copy of a newer game version as newer, without migrating it', () => {
    const text = JSON.stringify({ ...copy(), save: { ...copy().save, version: SAVE_VERSION + 1 } });
    expect(readCloudText(text, T0)).toEqual({ kind: 'newer', version: SAVE_VERSION + 1 });
  });

  it.each([
    ['not JSON', '{"rev":4,'],
    ['not an object', '[1,2]'],
    ['a string', '"save"'],
    ['no rev', JSON.stringify({ ...copy(), rev: undefined })],
    ['rev 0', JSON.stringify({ ...copy(), rev: 0 })],
    ['a fraction of a rev', JSON.stringify({ ...copy(), rev: 1.5 })],
    ['an empty id', JSON.stringify({ ...copy(), id: '' })],
    ['a lineage that is not a list', JSON.stringify({ ...copy(), lineage: 'c3' })],
    ['a lineage with a number', JSON.stringify({ ...copy(), lineage: ['c3', 7] })],
    ['no writer', JSON.stringify({ ...copy(), writer: null })],
    ['no moment', JSON.stringify({ ...copy(), savedAt: 'today' })],
    ['no save', JSON.stringify({ ...copy(), save: null })],
    [
      'a save without a version',
      JSON.stringify({ ...copy(), save: { ...copy().save, version: 'x' } }),
    ],
    [
      'a save without its coins',
      JSON.stringify({ ...copy(), save: { ...copy().save, coins: 'many' } }),
    ],
    [
      'a save without creatures',
      JSON.stringify({ ...copy(), save: { ...copy().save, creatures: null } }),
    ],
  ])('reads %s as unusable', (_name, text) => {
    expect(readCloudText(text, T0)).toEqual({ kind: 'unusable' });
  });
});

// The rows of the merge table (docs/08-architecture.md, section 5), from the top.
describe('decide', () => {
  it('row 1: a copy of a newer game version is blocked, whatever the local save', () => {
    expect(decide(local(), { kind: 'newer', version: SAVE_VERSION + 1 })).toEqual({
      kind: 'blocked',
    });
    expect(decide(fresh(), { kind: 'newer', version: SAVE_VERSION + 1 })).toEqual({
      kind: 'blocked',
    });
  });

  it('row 2: a migrated older copy goes on through the table', () => {
    const text = JSON.stringify({
      ...copy({ id: 'c3', lineage: ['c2'] }),
      save: asV10(copy().save),
    });
    const read = readCloudText(text, T0);
    expect(read.kind).toBe('copy');
    if (read.kind === 'unusable') return;
    expect(decide(local({ cloudId: 'c3' }), read)).toEqual({ kind: 'none' });
  });

  it('row 3: an empty cloud gets the save of a device that synced before', () => {
    expect(decide(local({ cloudRev: 1 }), EMPTY)).toEqual({ kind: 'send' });
    expect(decide(local({ cloudRev: 1, dirty: true }), EMPTY)).toEqual({ kind: 'send' });
  });

  it('row 4: an empty cloud makes a device that never synced wait', () => {
    expect(decide(fresh(), EMPTY)).toEqual({ kind: 'wait' });
    expect(decide(local({ cloudRev: 0, cloudId: '', dirty: true }), EMPTY)).toEqual({
      kind: 'wait',
    });
  });

  it('row 5: the same copy is sent again only after a change here', () => {
    const same = inCloud(copy({ id: 'c3', rev: 3 }));
    expect(decide(local({ cloudId: 'c3', dirty: true }), same)).toEqual({ kind: 'send' });
    expect(decide(local({ cloudId: 'c3', dirty: false }), same)).toEqual({ kind: 'none' });
  });

  it('row 6: a copy grown from ours is taken silently when nothing changed here', () => {
    const grown = copy();
    expect(decide(local({ cloudId: 'c3' }), inCloud(grown))).toEqual({
      kind: 'adopt',
      copy: grown,
      keepLocal: false,
    });
  });

  it('row 6 needs no change here: with one it is a choice', () => {
    const grown = copy();
    expect(decide(local({ cloudId: 'c3', dirty: true }), inCloud(grown))).toEqual({
      kind: 'choose',
      copy: grown,
    });
  });

  describe('row 7: a copy far ahead of ours, nothing changed here', () => {
    /** A lineage cut to the limit that no longer holds `c3`. */
    const cut = (length: number = CLOUD.lineageKeep): string[] =>
      Array.from({ length }, (_, i) => `x${i}`);
    const ahead = (over: Partial<CloudCopy> = {}): CloudCopy =>
      copy({ rev: 3 + CLOUD.lineageKeep + 5, id: 'far', lineage: cut(), ...over });

    it('is taken silently, the local save kept aside first', () => {
      const far = ahead();
      expect(decide(local({ cloudId: 'c3' }), inCloud(far))).toEqual({
        kind: 'adopt',
        copy: far,
        keepLocal: true,
      });
    });

    it('a copy grown from ours is still the plain silent take', () => {
      const far = ahead({ lineage: [...cut(CLOUD.lineageKeep - 1), 'c3'] });
      expect(decide(local({ cloudId: 'c3' }), inCloud(far))).toEqual({
        kind: 'adopt',
        copy: far,
        keepLocal: false,
      });
    });

    it.each<[string, Partial<Save['sync']>, Partial<CloudCopy>]>([
      ['a change here', { dirty: true }, {}],
      ['a rev not above ours', { cloudRev: 300 }, { rev: 300 }],
      ['a rev below ours', { cloudRev: 300 }, { rev: 299 }],
      ['a lineage one short of the limit', {}, { lineage: cut(CLOUD.lineageKeep - 1) }],
      ['an empty lineage', {}, { lineage: [] }],
    ])('is a choice with %s', (_name, sync, over) => {
      const far = ahead(over);
      expect(decide(local({ cloudId: 'c3', ...sync }), inCloud(far))).toEqual({
        kind: 'choose',
        copy: far,
      });
    });

    it('needs a copy this device knew: a device that never synced is not taken over', () => {
      const far = ahead();
      const never = local({ cloudRev: 0, cloudId: '', dirty: false });
      expect(decide(never, inCloud(far)).kind).toBe('choose');
      expect(
        decide(fresh({ sync: { cloudRev: 0, cloudId: '', dirty: false } }), inCloud(far)),
      ).toEqual({
        kind: 'found',
        copy: far,
      });
    });
  });

  it('row 8: an almost empty device is offered the copy', () => {
    const found = copy();
    expect(decide(fresh(), inCloud(found))).toEqual({ kind: 'found', copy: found });
  });

  it('row 9: changes on both sides are a choice', () => {
    const other = copy({ lineage: ['x1', 'x2'] });
    expect(decide(local({ cloudId: 'c3', dirty: true }), inCloud(other))).toEqual({
      kind: 'choose',
      copy: other,
    });
    expect(decide(local({ cloudId: 'c3', dirty: false }), inCloud(other))).toEqual({
      kind: 'choose',
      copy: other,
    });
  });

  it('row 9: two devices that wrote the same rev offline are a choice', () => {
    const theirs = copy({ rev: 4, id: 'b4', lineage: ['c1', 'c2'] });
    expect(decide(local({ cloudRev: 4, cloudId: 'a4', dirty: false }), inCloud(theirs))).toEqual({
      kind: 'choose',
      copy: theirs,
    });
  });

  it('row 9: a cloud rev below ours is a choice, never a silent take', () => {
    const behind = copy({ rev: 2, id: 'c2', lineage: ['c1'] });
    expect(decide(local({ cloudRev: 3, cloudId: 'c3' }), inCloud(behind))).toEqual({
      kind: 'choose',
      copy: behind,
    });
  });

  it('row 9: a device that never synced but played is a choice', () => {
    const theirs = copy();
    const played = local({ cloudRev: 0, cloudId: '', dirty: true });
    expect(decide(played, inCloud(theirs))).toEqual({ kind: 'choose', copy: theirs });
  });

  it('a device that never synced never matches an empty id in a lineage', () => {
    const odd = copy({ lineage: [] });
    expect(decide(local({ cloudRev: 0, cloudId: '', dirty: false }), inCloud(odd)).kind).toBe(
      'choose',
    );
  });
});

describe('almostEmpty', () => {
  it('holds for the save right after the tutorial run', () => {
    const tutorial = fresh({ stats: { ...fresh().stats, runs: 1, totalLayers: 12 }, coins: 40 });
    expect(almostEmpty(tutorial)).toBe(true);
  });

  it('allows runs up to the limit, not one more', () => {
    const at = fresh({ stats: { ...fresh().stats, runs: CLOUD.almostEmptyRuns } });
    const past = fresh({ stats: { ...fresh().stats, runs: CLOUD.almostEmptyRuns + 1 } });
    expect(almostEmpty(at)).toBe(true);
    expect(almostEmpty(past)).toBe(false);
  });

  it('still holds with "No ads" and the starter pack the store gave back', () => {
    const reinstalled = fresh({ purchases: { removeAds: true, starterPack: true } });
    expect(almostEmpty(reinstalled)).toBe(true);
    expect(decide(reinstalled, inCloud(copy())).kind).toBe('found');
  });

  it.each<[string, Partial<Save>]>([
    ['a baker level above 1', { bakerLevel: 2 }],
    ['a transaction paid out here', { iap: { processedTx: ['tx1'] } }],
    [
      'a purchase paid out here',
      { purchases: { removeAds: true, starterPack: false }, iap: { processedTx: ['tx1'] } },
    ],
    ['a sync before', { sync: { cloudRev: 1, cloudId: 'c1', dirty: true } }],
  ])('does not hold with %s', (_name, over) => {
    expect(almostEmpty(fresh(over))).toBe(false);
  });
});

describe('firstWriteDue', () => {
  const save = fresh();
  it('waits until the first notification or the end of the wait', () => {
    expect(firstWriteDue(save, false, T0)).toBe(false);
    expect(firstWriteDue(save, false, T0 + CLOUD.firstWriteWaitMs - 1)).toBe(false);
    expect(firstWriteDue(save, false, T0 + CLOUD.firstWriteWaitMs)).toBe(true);
    expect(firstWriteDue(save, true, T0)).toBe(true);
  });

  it('counts a save created in the future from the start of the cloud', () => {
    const ahead = fresh({ createdAt: T0 + 5 * 24 * 3600_000 });
    expect(firstWriteDue(ahead, false, T0 + CLOUD.firstWriteWaitMs - 1, T0)).toBe(false);
    expect(firstWriteDue(ahead, false, T0 + CLOUD.firstWriteWaitMs, T0)).toBe(true);
  });

  it('lets an old save (an update from 1.0) write at once', () => {
    const old = fresh({ createdAt: T0 - 30 * 24 * 3600_000 });
    expect(firstWriteDue(old, false, T0)).toBe(true);
  });
});

describe('nextCopy', () => {
  it('numbers the write past both the cloud and the device', () => {
    expect(nextCopy(local({ cloudRev: 3 }), copy({ rev: 7 }), 'n', T0).rev).toBe(8);
    expect(nextCopy(local({ cloudRev: 9 }), copy({ rev: 7 }), 'n', T0).rev).toBe(10);
    expect(nextCopy(local({ cloudRev: 0, cloudId: '' }), null, 'n', T0).rev).toBe(1);
  });

  it('remembers what the replaced copy grew from, the copy and our last one', () => {
    const next = nextCopy(
      local({ cloudId: 'a2' }),
      copy({ id: 'c4', lineage: ['c1', 'c3'] }),
      'n5',
      T0,
    );
    expect(next.lineage).toEqual(['c1', 'c3', 'c4', 'a2']);
    expect(next).toMatchObject({ id: 'n5', writer: 'device-a', savedAt: T0 });
  });

  it('keeps each id once, the latest place wins', () => {
    const next = nextCopy(
      local({ cloudId: 'c3' }),
      copy({ id: 'c3', lineage: ['c1', 'c2'] }),
      'n',
      T0,
    );
    expect(next.lineage).toEqual(['c1', 'c2', 'c3']);
  });

  it('keeps the newest ids up to the limit', () => {
    const long = Array.from({ length: CLOUD.lineageKeep + 10 }, (_, i) => `id${i}`);
    const next = nextCopy(local({ cloudId: '' }), copy({ id: 'last', lineage: long }), 'n', T0);
    expect(next.lineage).toHaveLength(CLOUD.lineageKeep);
    expect(next.lineage[next.lineage.length - 1]).toBe('last');
  });

  it('carries the save with its own sync', () => {
    const next = nextCopy(local({ dirty: true }), null, 'n', T0);
    expect(next.save.sync).toEqual({ cloudRev: 4, cloudId: 'n', dirty: false });
    expect(next.save.coins).toBe(900);
  });

  it('is read back as the same copy, and a device that sent it sees nothing to do', () => {
    const sender = local({ dirty: true });
    const sent = nextCopy(sender, copy({ id: 'c3', rev: 3 }), 'n4', T0);
    const read = readCloudText(serializeCopy(sent), T0);
    expect(read).toEqual({ kind: 'copy', copy: sent });
    const after = { ...sender, sync: { cloudRev: sent.rev, cloudId: sent.id, dirty: false } };
    if (read.kind !== 'copy') return;
    expect(decide(after, read)).toEqual({ kind: 'none' });
    // A device that synced with the replaced copy and changed nothing takes it silently.
    expect(decide(local({ cloudId: 'c3' }), read)).toEqual({
      kind: 'adopt',
      copy: sent,
      keepLocal: false,
    });
  });
});
