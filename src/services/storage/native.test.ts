import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import { loadSave, serializeSave } from '../../core/save/load';
import { STORAGE_KEYS } from '../../data/app/storage';
import { type KeyValuePlugin, NativeStorage } from './native';
import { WebStorage } from './web';

/** The plugin as the app sees it: a map of strings, answers come later (a bridge call). */
class FakePreferences implements KeyValuePlugin {
  readonly data = new Map<string, string>();
  fail = false;

  get({ key }: { key: string }): Promise<{ value: string | null }> {
    if (this.fail) return Promise.reject(new Error('bridge'));
    return Promise.resolve({ value: this.data.get(key) ?? null });
  }

  set({ key, value }: { key: string; value: string }): Promise<void> {
    if (this.fail) return Promise.reject(new Error('bridge'));
    this.data.set(key, value);
    return Promise.resolve();
  }

  remove({ key }: { key: string }): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }
}

class FakeLocalStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('NativeStorage', () => {
  it('reads, writes and removes through the plugin', async () => {
    const plugin = new FakePreferences();
    const storage = new NativeStorage(plugin);
    expect(await storage.get('save')).toBeNull();
    await storage.set('save', 'abc');
    expect(plugin.data.get('save')).toBe('abc');
    expect(await storage.get('save')).toBe('abc');
    await storage.remove('save');
    expect(await storage.get('save')).toBeNull();
  });

  it('keeps the save format of the browser: the same text under the same keys', async () => {
    const save = createDefaultSave(1_700_000_000_000, 'install-1');
    save.coins = 1234;
    save.records.classicHeight = 87;
    const text = serializeSave(save);
    const plugin = new FakePreferences();
    const web = new FakeLocalStorage();
    await new NativeStorage(plugin).set(STORAGE_KEYS.save, text);
    await new WebStorage(() => web as unknown as Storage).set(STORAGE_KEYS.save, text);
    expect(plugin.data.get(STORAGE_KEYS.save)).toBe(web.data.get(STORAGE_KEYS.save));
    // A save written by the app loads back to the same save.
    const back = await new NativeStorage(plugin).get(STORAGE_KEYS.save);
    const loaded = loadSave(back, null, 1_700_000_000_000, () => 'other');
    expect(loaded.save).toEqual(save);
  });

  it('starts a write at once, before the returned promise is awaited', () => {
    const plugin = new FakePreferences();
    void new NativeStorage(plugin).set('save', 'now');
    expect(plugin.data.get('save')).toBe('now');
  });

  it('passes failures on as rejections, also a call that throws at once', async () => {
    const plugin = new FakePreferences();
    plugin.fail = true;
    const storage = new NativeStorage(plugin);
    await expect(storage.get('save')).rejects.toThrow('bridge');
    await expect(storage.set('save', 'x')).rejects.toThrow('bridge');
    const throwing = new NativeStorage({
      ...plugin,
      get: () => {
        throw new Error('sync');
      },
      set: plugin.set.bind(plugin),
      remove: plugin.remove.bind(plugin),
    });
    await expect(throwing.get('save')).rejects.toThrow('sync');
  });
});
