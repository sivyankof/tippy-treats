import type { StorageService } from './types';

/** What the storage needs of `@capacitor/preferences` (injected, so tests run without the app). */
export interface KeyValuePlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

/**
 * The storage of the apps on `@capacitor/preferences` (UserDefaults on iOS, SharedPreferences on
 * Android): it outlives the app being unloaded from memory and is not cleared by the system the
 * way web storage of a web view can be. The values are the same strings under the same keys as in
 * the browser (`STORAGE_KEYS`), so the save format does not change. Failures are not hidden: a read
 * that fails rejects (the game then runs on a save that is never written) and a write that fails
 * rejects (the game tries again later), as `state/save-store.ts` expects. Every call goes to the
 * plugin at once, not after an await, so the write on going to the background starts right away.
 */
export class NativeStorage implements StorageService {
  constructor(private readonly plugin: KeyValuePlugin) {}

  get(key: string): Promise<string | null> {
    return this.call(() => this.plugin.get({ key })).then((result) => result.value ?? null);
  }

  set(key: string, value: string): Promise<void> {
    return this.call(() => this.plugin.set({ key, value }));
  }

  remove(key: string): Promise<void> {
    return this.call(() => this.plugin.remove({ key }));
  }

  /** A plugin call that throws at once becomes a rejected promise, like one that fails later. */
  private call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return run();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
