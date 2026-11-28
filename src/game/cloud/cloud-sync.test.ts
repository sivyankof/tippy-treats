import { describe, expect, it, vi } from 'vitest';
import {
  nextCopy,
  readCloudText,
  serializeCopy,
  type CloudCopy,
} from '../../core/save/cloud-merge';
import { createDefaultSave } from '../../core/save/defaults';
import { SAVE_VERSION, type Save } from '../../core/save/schema';
import { CLOUD, REPLACED_SAVE_PREFIX } from '../../data/app/cloud';
import { MemoryStorage } from '../../services/storage/memory';
import type { CloudSaveService } from '../../services/cloud-save/types';
import { STORAGE_KEYS } from '../../data/app/storage';
import { serializeSave } from '../../core/save/load';
import { GameState } from '../../state/game-state';
import { CloudSync } from './cloud-sync';

const T0 = Date.UTC(2026, 10, 25, 12, 0, 0);
const DAY = 24 * 3600_000;

/** Timers that fire only when told. */
function timers() {
  let next = 1;
  const due = new Map<number, { at: number; run: () => void }>();
  const clock = { ms: T0 };
  return {
    clock,
    scheduler: {
      set: (run: () => void, delay: number) => {
        const id = next++;
        due.set(id, { at: clock.ms + delay, run });
        return id;
      },
      clear: (id: unknown) => void due.delete(id as number),
    },
    /** Moves the clock and fires what came due. */
    advance(ms: number) {
      clock.ms += ms;
      for (const [id, timer] of [...due]) {
        if (timer.at <= clock.ms) {
          due.delete(id);
          timer.run();
        }
      }
    },
    pending: () => due.size,
  };
}

/** A cloud in memory; `remote()` plays another device writing. */
function fakeCloud(text: string | null = null) {
  const store = { text, previous: undefined as string | undefined };
  let listener: () => void = () => undefined;
  const service: CloudSaveService & {
    on: boolean;
    failRead: boolean;
    failWrite: boolean;
    hang: boolean;
  } = {
    on: true,
    failRead: false,
    failWrite: false,
    hang: false,
    available: () => Promise.resolve(service.on),
    read: () =>
      service.hang
        ? new Promise(() => undefined)
        : service.failRead
          ? Promise.reject(new Error('read'))
          : Promise.resolve(store.text),
    write: vi.fn((t: string, previous?: string) => {
      if (service.failWrite) return Promise.resolve(false);
      if (previous !== undefined) store.previous = previous;
      store.text = t;
      return Promise.resolve(true);
    }),
    onRemoteChange: (l) => {
      listener = l;
      return () => undefined;
    },
  };
  return { service, store, remote: (t: string | null) => ((store.text = t), listener()) };
}

/** Lets every pending promise settle. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

async function setup(save: Save, cloudText: string | null = null) {
  const t = timers();
  const storage = new MemoryStorage();
  await storage.set(STORAGE_KEYS.save, serializeSave(save));
  const state = new GameState({
    storage,
    realNow: () => t.clock.ms,
    now: () => t.clock.ms,
    makeInstallId: () => 'unused',
    scheduler: { set: () => 0, clear: () => undefined },
  });
  await state.load();
  const cloud = fakeCloud(cloudText);
  let ids = 0;
  const afterAdopt = vi.fn(() => Promise.resolve());
  let blocked = false;
  const sync = new CloudSync({
    service: cloud.service,
    state,
    now: () => t.clock.ms,
    newId: () => `n${++ids}`,
    scheduler: t.scheduler,
    afterAdopt,
    blocked: () => blocked,
  });
  return { t, storage, state, cloud, sync, afterAdopt, block: () => (blocked = true) };
}

/** A player who synced copy `c3` and played since (or not). */
function player(dirty: boolean, over: Partial<Save> = {}): Save {
  const base = createDefaultSave(T0 - 40 * DAY, 'device-a');
  return {
    ...base,
    bakerLevel: 8,
    coins: 700,
    stats: { ...base.stats, runs: 30 },
    sync: { cloudRev: 3, cloudId: 'c3', dirty },
    ...over,
  };
}

/** A new install: never synced, nothing played, created just now. */
const fresh = (): Save => createDefaultSave(T0, 'device-new');

function foreign(over: Partial<CloudCopy> = {}): CloudCopy {
  const save = { ...createDefaultSave(T0 - 60 * DAY, 'device-b'), bakerLevel: 12, coins: 3000 };
  return {
    rev: 4,
    id: 'b4',
    lineage: ['c1', 'c2', 'c3'],
    writer: 'device-b',
    savedAt: T0 - DAY,
    save,
    ...over,
  };
}

const written = (text: string | null): CloudCopy => {
  const read = readCloudText(text, T0);
  if (read.kind !== 'copy') throw new Error(`no copy: ${read.kind}`);
  return read.copy;
};

describe('CloudSync', () => {
  it('sends to an empty cloud the save of a device that synced before', async () => {
    const { sync, cloud, state } = await setup(player(true));
    sync.start();
    await settle();
    const copy = written(cloud.store.text);
    expect(copy).toMatchObject({ rev: 4, id: 'n1', lineage: ['c3'], writer: 'device-a' });
    expect(copy.save.coins).toBe(700);
    expect(state.data.sync).toEqual({ cloudRev: 4, cloudId: 'n1', dirty: false });
    expect(sync.status).toBe('saved');
    expect(sync.savedAt).toBe(T0);
  });

  it('lets a new install wait over an empty cloud until the first notification', async () => {
    const { sync, cloud } = await setup(fresh());
    sync.start();
    await settle();
    expect(cloud.service.write).not.toHaveBeenCalled();
    expect(sync.status).toBe('waiting');
    cloud.remote(null);
    await settle();
    expect(written(cloud.store.text).rev).toBe(1);
  });

  it('lets a new install wait over an empty cloud until the wait is over, then reads again', async () => {
    const { sync, cloud, t } = await setup(fresh());
    sync.start();
    await settle();
    t.advance(CLOUD.firstWriteWaitMs - 1);
    await settle();
    expect(cloud.service.write).not.toHaveBeenCalled();
    t.advance(1);
    await settle();
    expect(written(cloud.store.text).rev).toBe(1);
  });

  it('a copy that came during the wait is offered, never written over', async () => {
    const { sync, cloud, t } = await setup(fresh());
    sync.start();
    await settle();
    cloud.store.text = serializeCopy(foreign());
    t.advance(CLOUD.firstWriteWaitMs);
    await settle();
    expect(cloud.service.write).not.toHaveBeenCalled();
    expect(sync.homeDecision()?.kind).toBe('found');
  });

  it('writes at once for a player updating from 1.0 (an old save)', async () => {
    const { sync, cloud } = await setup(
      player(true, { sync: { cloudRev: 0, cloudId: '', dirty: true } }),
    );
    sync.start();
    await settle();
    expect(written(cloud.store.text).rev).toBe(1);
  });

  it('sends the same copy again only after a change here', async () => {
    const own = nextCopy(
      player(false, { sync: { cloudRev: 2, cloudId: 'c2', dirty: false } }),
      null,
      'c3',
      T0 - DAY,
    );
    const clean = await setup(player(false), serializeCopy(own));
    clean.sync.start();
    await settle();
    expect(clean.cloud.service.write).not.toHaveBeenCalled();
    expect(clean.sync.status).toBe('saved');
    expect(clean.sync.savedAt).toBe(T0 - DAY);
    const dirty = await setup(player(true), serializeCopy(own));
    dirty.sync.start();
    await settle();
    expect(written(dirty.cloud.store.text)).toMatchObject({ rev: 4, lineage: ['c2', 'c3'] });
    // Our own copy is not kept in the second key.
    expect(dirty.cloud.store.previous).toBeUndefined();
  });

  it('takes a copy grown from ours on Home, silently, then checks the purchases', async () => {
    const { sync, cloud, state, afterAdopt } = await setup(player(false), serializeCopy(foreign()));
    sync.start();
    await settle();
    expect(cloud.service.write).not.toHaveBeenCalled();
    const decision = sync.homeDecision();
    expect(decision?.kind).toBe('adopt');
    if (decision?.kind !== 'adopt') return;
    await sync.takeCloud(decision.copy, false);
    expect(state.data.coins).toBe(3000);
    expect(state.data.installId).toBe('device-a');
    expect(state.data.sync).toEqual({ cloudRev: 4, cloudId: 'b4', dirty: false });
    expect(afterAdopt).toHaveBeenCalledTimes(1);
    expect(sync.homeDecision()).toBeNull();
    expect(sync.status).toBe('saved');
  });

  it('"Progress found": nothing is written before the answer; "Start over" keeps the copy aside and writes over it', async () => {
    const { sync, cloud, state, storage } = await setup(fresh(), serializeCopy(foreign()));
    sync.start();
    await settle();
    sync.sync();
    await settle();
    expect(cloud.service.write).not.toHaveBeenCalled();
    const decision = sync.homeDecision();
    expect(decision?.kind).toBe('found');
    if (decision?.kind !== 'found') return;
    const before = cloud.store.text;
    await sync.keepLocal(decision.copy);
    const copy = written(cloud.store.text);
    expect(copy).toMatchObject({ rev: 5, writer: 'device-new', lineage: ['c1', 'c2', 'c3', 'b4'] });
    expect(copy.save.bakerLevel).toBe(1);
    expect(cloud.store.previous).toBe(before);
    expect(state.data.sync.cloudRev).toBe(5);
    expect(await storage.get(`${REPLACED_SAVE_PREFIX}${T0}`)).toContain('"bakerLevel":12');
    expect(sync.homeDecision()).toBeNull();
  });

  it('"Progress found": "Restore" keeps the local save aside and takes the copy', async () => {
    const { sync, state, storage } = await setup(fresh(), serializeCopy(foreign()));
    sync.start();
    await settle();
    const decision = sync.homeDecision();
    if (decision?.kind !== 'found') throw new Error('expected found');
    await sync.takeCloud(decision.copy, true);
    expect(state.data.bakerLevel).toBe(12);
    expect(await storage.get(`${REPLACED_SAVE_PREFIX}${T0}`)).toContain('"installId":"device-new"');
  });

  it('a choice after changes on both sides: either side wins', async () => {
    const keepHere = await setup(player(true), serializeCopy(foreign({ lineage: ['x1'] })));
    keepHere.sync.start();
    await settle();
    expect(keepHere.cloud.service.write).not.toHaveBeenCalled();
    const choice = keepHere.sync.homeDecision();
    expect(choice?.kind).toBe('choose');
    if (choice?.kind !== 'choose') return;
    await keepHere.sync.keepLocal(choice.copy);
    expect(written(keepHere.cloud.store.text).save.coins).toBe(700);

    const keepCloud = await setup(player(true), serializeCopy(foreign({ lineage: ['x1'] })));
    keepCloud.sync.start();
    await settle();
    const other = keepCloud.sync.homeDecision();
    if (other?.kind !== 'choose') throw new Error('expected choose');
    await keepCloud.sync.takeCloud(other.copy, true);
    expect(keepCloud.state.data.coins).toBe(3000);
    expect(await keepCloud.storage.get(`${REPLACED_SAVE_PREFIX}${T0}`)).toContain('"coins":700');
  });

  it('a copy of a newer game is neither taken nor written over, even when forced', async () => {
    const newer = JSON.stringify({
      ...foreign(),
      save: { ...foreign().save, version: SAVE_VERSION + 1 },
    });
    const { sync, cloud } = await setup(player(true), newer);
    sync.start();
    await settle();
    expect(sync.status).toBe('update');
    expect(sync.homeDecision()).toBeNull();
    await sync.keepLocal(foreign());
    expect(cloud.service.write).not.toHaveBeenCalled();
    expect(cloud.store.text).toBe(newer);
  });

  it('an unusable copy is left alone, the game goes on locally', async () => {
    const { sync, cloud } = await setup(player(true), '{"rev":');
    sync.start();
    await settle();
    expect(sync.status).toBe('error');
    expect(sync.homeDecision()).toBeNull();
    await sync.sync({ immediate: true });
    expect(cloud.service.write).not.toHaveBeenCalled();
  });

  it('iCloud off, a failed read or a read past the timeout never write', async () => {
    const off = await setup(player(true));
    off.cloud.service.on = false;
    off.sync.start();
    await settle();
    expect(off.sync.status).toBe('off');

    const failing = await setup(player(true));
    failing.cloud.service.failRead = true;
    failing.sync.start();
    await settle();
    expect(failing.sync.status).toBe('error');

    const slow = await setup(player(true));
    slow.cloud.service.hang = true;
    slow.sync.start();
    await settle();
    slow.t.advance(CLOUD.readTimeoutMs);
    await settle();
    expect(slow.sync.status).toBe('error');
    for (const each of [off, failing, slow])
      expect(each.cloud.service.write).not.toHaveBeenCalled();
  });

  it('"Keep" never goes over a copy that came after the window opened', async () => {
    const { sync, cloud, t } = await setup(
      player(true),
      serializeCopy(foreign({ lineage: ['x1'] })),
    );
    sync.start();
    await settle();
    const shown = sync.homeDecision();
    if (shown?.kind !== 'choose') throw new Error('expected choose');
    const newer = nextCopy(shown.copy.save, shown.copy, 'b5', T0);
    cloud.store.text = serializeCopy(newer);
    t.advance(1);
    await sync.keepLocal(shown.copy);
    expect(cloud.service.write).not.toHaveBeenCalled();
    expect(sync.homeDecision()).toEqual({ kind: 'choose', copy: newer });
  });

  it('a silent take is dropped when the save changed before its turn', async () => {
    const { sync, state } = await setup(player(false), serializeCopy(foreign()));
    sync.start();
    await settle();
    const decision = sync.homeDecision();
    if (decision?.kind !== 'adopt') throw new Error('expected adopt');
    state.addCoins(1);
    await sync.takeCloud(decision.copy, false);
    expect(state.data.coins).toBe(701);
    expect(sync.homeDecision()?.kind).toBe('choose');
  });

  it('nothing is replaced when the losing save cannot be kept', async () => {
    const { sync, state, cloud, storage } = await setup(
      player(true),
      serializeCopy(foreign({ lineage: ['x1'] })),
    );
    sync.start();
    await settle();
    const decision = sync.homeDecision();
    if (decision?.kind !== 'choose') throw new Error('expected choose');
    storage.set = () => Promise.reject(new Error('full'));
    await sync.takeCloud(decision.copy, true);
    expect(state.data.coins).toBe(700);
    await sync.keepLocal(decision.copy);
    expect(cloud.service.write).not.toHaveBeenCalled();
    // Home asks again on its next entry.
    expect(sync.homeDecision()?.kind).toBe('choose');
  });

  it('a write that answered too late but landed counts as sent', async () => {
    const { sync, cloud, state, t } = await setup(player(true));
    const write = cloud.service.write;
    cloud.service.write = vi.fn((text: string) => {
      cloud.store.text = text;
      return new Promise<boolean>(() => undefined);
    });
    sync.start();
    await settle();
    t.advance(CLOUD.readTimeoutMs);
    await settle();
    expect(sync.status).toBe('saved');
    expect(state.data.sync).toMatchObject({ cloudId: 'n1', dirty: false });
    cloud.service.write = write;
  });

  it('keeps the copy it writes over in the second key when it is not the one this device last knew', async () => {
    const ownOld = foreign({ writer: 'device-a', id: 'a9', lineage: ['x1'] });
    const { sync, cloud } = await setup(player(true), serializeCopy(ownOld));
    sync.start();
    await settle();
    const decision = sync.homeDecision();
    if (decision?.kind !== 'choose') throw new Error('expected choose');
    await sync.keepLocal(decision.copy);
    expect(cloud.store.previous).toBe(serializeCopy(ownOld));
  });

  it('tells a new write to the line even when the status stays saved', async () => {
    const { sync, state, t } = await setup(player(true));
    sync.start();
    await settle();
    let calls = 0;
    sync.onStatus(() => (calls += 1));
    state.addCoins(1);
    t.advance(CLOUD.writeIntervalMs);
    await sync.sync();
    expect(sync.savedAt).toBe(T0 + CLOUD.writeIntervalMs);
    expect(calls).toBeGreaterThan(0);
  });

  it('counts the first-write wait of a save created in the future from the start', async () => {
    const { sync, cloud, t } = await setup({ ...fresh(), createdAt: T0 + 3 * DAY });
    sync.start();
    await settle();
    t.advance(CLOUD.firstWriteWaitMs);
    await settle();
    expect(written(cloud.store.text).rev).toBe(1);
  });

  it('a store that never answers does not hold later passes', async () => {
    const { sync, cloud, t, state } = await setup(player(true));
    const available = cloud.service.available;
    cloud.service.available = () => new Promise(() => undefined);
    sync.start();
    await settle();
    t.advance(CLOUD.readTimeoutMs);
    await settle();
    expect(sync.status).toBe('off');
    cloud.service.available = available;
    const write = cloud.service.write;
    cloud.service.write = vi.fn(() => new Promise<boolean>(() => undefined));
    void sync.sync({ immediate: true });
    await settle();
    t.advance(CLOUD.readTimeoutMs);
    await settle();
    expect(sync.status).toBe('error');
    expect(state.data.sync.dirty).toBe(true);
    cloud.service.write = write;
    void sync.sync({ immediate: true });
    await settle();
    expect(sync.status).toBe('saved');
  });

  it('writes at most once per interval; a change inside it goes at its end', async () => {
    const { sync, cloud, state, t } = await setup(player(true));
    sync.start();
    await settle();
    expect(cloud.service.write).toHaveBeenCalledTimes(1);
    state.addCoins(5);
    await sync.sync();
    expect(cloud.service.write).toHaveBeenCalledTimes(1);
    t.advance(CLOUD.writeIntervalMs);
    await settle();
    expect(cloud.service.write).toHaveBeenCalledTimes(2);
    expect(written(cloud.store.text).save.coins).toBe(705);
  });

  it('a failed write leaves the save marked as changed', async () => {
    const { sync, cloud, state } = await setup(player(true));
    cloud.service.failWrite = true;
    sync.start();
    await settle();
    expect(sync.status).toBe('error');
    expect(state.data.sync).toEqual({ cloudRev: 3, cloudId: 'c3', dirty: true });
  });

  it('does nothing while blocked', async () => {
    const { sync, cloud, block } = await setup(player(true));
    block();
    sync.start();
    await settle();
    expect(cloud.service.write).not.toHaveBeenCalled();
    expect(sync.homeDecision()).toBeNull();
  });

  it('a remote change is read and left for Home', async () => {
    const { sync, cloud } = await setup(player(true));
    sync.start();
    await settle();
    const ours = written(cloud.store.text);
    const theirs = nextCopy({ ...ours.save, coins: 9000, installId: 'device-b' }, ours, 'b9', T0);
    cloud.remote(serializeCopy(theirs));
    await settle();
    expect(sync.homeDecision()).toEqual({ kind: 'adopt', copy: theirs });
  });

  it('answers first after the first pass, or at the timeout', async () => {
    const quick = await setup(player(true));
    quick.sync.start();
    await quick.sync.waitFirstAnswer(1000);
    expect(quick.sync.status).toBe('saved');

    const slow = await setup(player(true));
    slow.cloud.service.hang = true;
    slow.sync.start();
    let done = false;
    void slow.sync.waitFirstAnswer(500).then(() => (done = true));
    await settle();
    expect(done).toBe(false);
    slow.t.advance(500);
    await settle();
    expect(done).toBe(true);

    const disabled = await setup(player(true));
    disabled.sync.disable('error');
    await disabled.sync.waitFirstAnswer(1000);
    expect(disabled.sync.status).toBe('error');
  });
});
