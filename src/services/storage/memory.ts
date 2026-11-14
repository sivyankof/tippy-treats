import type { StorageService } from './types';

/** Storage that lives as long as the page: the fallback of the web storage and the fake of the tests. */
export class MemoryStorage implements StorageService {
  private readonly items = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.items.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.items.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.items.delete(key);
    return Promise.resolve();
  }

  keys(): string[] {
    return [...this.items.keys()];
  }
}
