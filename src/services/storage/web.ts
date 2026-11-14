import { MemoryStorage } from './memory';
import type { StorageService } from './types';

/** Gives the browser storage, or null when there is none; the access itself may throw (blocked cookies). */
export type StorageSource = () => Storage | null;

const browserStorage: StorageSource = () =>
  typeof window === 'undefined' ? null : window.localStorage;

/**
 * Browser storage on top of `localStorage`. Every access is guarded: in private mode or with
 * blocked site data a value is kept in memory for the life of the page instead, and nothing throws.
 * A write is invoked at once (not after an await), so a flush on page hide reaches the storage.
 */
export class WebStorage implements StorageService {
  private readonly fallback = new MemoryStorage();

  constructor(private readonly source: StorageSource = browserStorage) {}

  private open(): Storage | null {
    try {
      return this.source();
    } catch {
      return null;
    }
  }

  get(key: string): Promise<string | null> {
    try {
      const value = this.open()?.getItem(key);
      if (value !== undefined && value !== null) return Promise.resolve(value);
    } catch {
      // Falls through to the in-memory copy.
    }
    return this.fallback.get(key);
  }

  set(key: string, value: string): Promise<void> {
    try {
      const storage = this.open();
      if (storage) {
        storage.setItem(key, value);
        void this.fallback.remove(key);
        return Promise.resolve();
      }
    } catch {
      // Quota or blocked storage: keep it in memory.
    }
    return this.fallback.set(key, value);
  }

  remove(key: string): Promise<void> {
    try {
      this.open()?.removeItem(key);
    } catch {
      // Nothing to remove from a storage that cannot be used.
    }
    return this.fallback.remove(key);
  }
}
