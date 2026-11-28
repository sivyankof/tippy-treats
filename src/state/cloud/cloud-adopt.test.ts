import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import { loadSave } from '../../core/save/load';
import type { Save } from '../../core/save/schema';
import { REPLACED_SAVE_PREFIX } from '../../data/app/cloud';
import { MemoryStorage } from '../../services/storage/memory';
import { withCloudAdopted, withCloudSent } from './cloud-adopt';
import { GameState } from '../game-state';
import { loadTestState } from '../test-state';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const DAY = 24 * 3600_000;

/** This device: its own settings, counters and a purchase of 80 berries paid out here. */
function device(): Save {
  const base = createDefaultSave(T0 - 30 * DAY, 'device-a');
  return {
    ...base,
    lastSeenAt: T0,
    berries: 120,
    bakerLevel: 6,
    settings: { ...base.settings, music: false, lang: 'ru' },
    consent: { attAsked: true, notifAsked: true },
    ads: { ...base.ads, sessions: 40, offerDay: '2026-11-19' },
    notif: { giftDay: '2026-11-19' },
    review: { askedVersion: '1.1.0', askedAt: T0 - DAY, playDays: 9, lastPlayDay: '2026-11-19' },
    iap: { processedTx: ['tx-here'] },
    sync: { cloudRev: 2, cloudId: 'c2', dirty: true },
  };
}

/** Another device's copy: more progress, its own install, settings and transactions. */
function cloudSave(): Save {
  const base = createDefaultSave(T0 - 60 * DAY, 'device-b');
  return {
    ...base,
    lastSeenAt: T0 + 5 * DAY,
    coins: 5000,
    berries: 30,
    bakerLevel: 14,
    records: { ...base.records, classicHeight: 88 },
    settings: { ...base.settings, music: true, lang: 'en' },
    consent: { attAsked: false, notifAsked: false },
    review: { askedVersion: '', askedAt: 0, playDays: 2, lastPlayDay: '' },
    iap: { processedTx: ['tx-there'] },
    sync: { cloudRev: 5, cloudId: 'b5', dirty: false },
  };
}

describe('withCloudAdopted', () => {
  const adopted = withCloudAdopted(device(), { rev: 7, id: 'c7', save: cloudSave() });

  it('takes the progress of the copy', () => {
    expect(adopted.coins).toBe(5000);
    expect(adopted.bakerLevel).toBe(14);
    expect(adopted.records.classicHeight).toBe(88);
    expect(adopted.createdAt).toBe(cloudSave().createdAt);
  });

  it('keeps what describes this device', () => {
    const here = device();
    expect(adopted.installId).toBe('device-a');
    expect(adopted.lastSeenAt).toBe(here.lastSeenAt);
    expect(adopted.consent).toEqual(here.consent);
    expect(adopted.ads).toEqual(here.ads);
    expect(adopted.notif).toEqual(here.notif);
    expect(adopted.review).toEqual(here.review);
    expect(adopted.settings).toEqual(here.settings);
  });

  it('takes the paid transactions of the copy, not a union', () => {
    expect(adopted.iap.processedTx).toEqual(['tx-there']);
  });

  it('knows the copy, with nothing changed since', () => {
    expect(adopted.sync).toEqual({ cloudRev: 7, cloudId: 'c7', dirty: false });
  });
});

describe('withCloudSent', () => {
  it('knows the sent copy and keeps the flag when the progress moved meanwhile', () => {
    expect(withCloudSent(device(), 3, 'c3', false).sync).toEqual({
      cloudRev: 3,
      cloudId: 'c3',
      dirty: false,
    });
    expect(withCloudSent(device(), 3, 'c3', true).sync).toEqual({
      cloudRev: 3,
      cloudId: 'c3',
      dirty: true,
    });
  });
});

describe('GameState cloud copy', () => {
  it('a purchase of this device missing from the taken copy is paid again exactly once', async () => {
    const clock = { ms: T0 };
    const state = await loadTestState(device(), clock);
    const purchase = {
      key: 'berries_80' as const,
      transactionId: 'tx-here',
      purchasedAt: T0 - DAY,
    };
    expect(state.unpaidTransactions([purchase])).toEqual([]);
    state.adopt({ rev: 7, id: 'c7', save: cloudSave() });
    expect(state.berries).toBe(30);
    // The purchase check after taking the copy (`syncPurchases`).
    const unpaid = state.unpaidTransactions([purchase]);
    expect(unpaid).toEqual([purchase]);
    for (const tx of unpaid) expect(state.grantProduct(tx.key, [tx.transactionId])).toBe(true);
    const paid = state.berries;
    expect(paid).toBeGreaterThan(30);
    // The next check finds nothing to pay, and a second grant is refused.
    expect(state.unpaidTransactions([purchase])).toEqual([]);
    expect(state.grantProduct('berries_80', ['tx-here'])).toBe(false);
    expect(state.berries).toBe(paid);
    expect(state.data.iap.processedTx).toEqual(['tx-there', 'tx-here']);
  });

  it('writes the taken copy at once and reads it back after a restart', async () => {
    const storage = new MemoryStorage();
    const clock = { ms: T0 };
    const deps = {
      storage,
      realNow: () => clock.ms,
      now: () => clock.ms,
      makeInstallId: () => 'new-id',
      scheduler: { set: () => 0, clear: () => undefined },
    };
    const state = new GameState(deps);
    await state.load();
    state.adopt({ rev: 7, id: 'c7', save: cloudSave() });
    await Promise.resolve();
    const reloaded = loadSave(await storage.get('save'), null, T0, () => 'x');
    expect(reloaded.save.bakerLevel).toBe(14);
    expect(reloaded.save.sync).toEqual({ cloudRev: 7, cloudId: 'c7', dirty: false });
  });

  it('clears the flag after a send only when the progress did not move meanwhile', async () => {
    const clock = { ms: T0 };
    const state = await loadTestState(device(), clock);
    const mark = state.progressMark;
    state.markCloudSent(3, 'c3', mark);
    expect(state.data.sync).toEqual({ cloudRev: 3, cloudId: 'c3', dirty: false });
    const before = state.progressMark;
    state.addCoins(5);
    state.markCloudSent(4, 'c4', before);
    expect(state.data.sync).toEqual({ cloudRev: 4, cloudId: 'c4', dirty: true });
  });

  it('a taken copy counts as a move of the progress for a send already on its way', async () => {
    const clock = { ms: T0 };
    const state = await loadTestState(device(), clock);
    const mark = state.progressMark;
    state.adopt({ rev: 7, id: 'c7', save: cloudSave() });
    state.markCloudSent(8, 'c8', mark);
    expect(state.data.sync.dirty).toBe(true);
  });

  it('keeps a replaced save under its own key', async () => {
    const storage = new MemoryStorage();
    const clock = { ms: T0 };
    const state = new GameState({
      storage,
      realNow: () => clock.ms,
      makeInstallId: () => 'id',
      scheduler: { set: () => 0, clear: () => undefined },
    });
    await state.load();
    expect(await state.keepReplaced(cloudSave())).toBe(true);
    const kept = await storage.get(`${REPLACED_SAVE_PREFIX}${T0}`);
    expect(kept).not.toBeNull();
    expect(JSON.parse(kept ?? '{}')).toMatchObject({ bakerLevel: 14 });
  });

  it('keeps nothing when the save could not be read', async () => {
    const storage = new MemoryStorage();
    storage.get = () => Promise.reject(new Error('broken'));
    const state = new GameState({
      storage,
      realNow: () => T0,
      makeInstallId: () => 'id',
      scheduler: { set: () => 0, clear: () => undefined },
    });
    expect((await state.load()).status).toBe('read_failed');
    expect(await state.keepReplaced(cloudSave())).toBe(false);
  });
});

describe('withCloudAdopted and "No ads"', () => {
  it('keeps "No ads" of this device on and takes the starter pack from the copy', () => {
    const here = { ...device(), purchases: { removeAds: true, starterPack: true } };
    const copy = { ...cloudSave(), purchases: { removeAds: false, starterPack: false } };
    const taken = withCloudAdopted(here, { rev: 5, id: 'c5', save: copy });
    expect(taken.purchases).toEqual({ removeAds: true, starterPack: false });
  });

  it('keeps "No ads" of the copy when this device has none', () => {
    const copy = { ...cloudSave(), purchases: { removeAds: true, starterPack: true } };
    const taken = withCloudAdopted(device(), { rev: 5, id: 'c5', save: copy });
    expect(taken.purchases).toEqual({ removeAds: true, starterPack: true });
  });
});
