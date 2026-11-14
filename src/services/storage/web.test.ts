import { describe, expect, it } from 'vitest';
import { WebStorage } from './web';

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

const asStorage = (fake: FakeLocalStorage): Storage => fake as unknown as Storage;

describe('WebStorage', () => {
  it('reads, writes and removes through localStorage', async () => {
    const fake = new FakeLocalStorage();
    const storage = new WebStorage(() => asStorage(fake));
    expect(await storage.get('save')).toBeNull();
    await storage.set('save', 'abc');
    expect(fake.data.get('save')).toBe('abc');
    expect(await storage.get('save')).toBe('abc');
    await storage.remove('save');
    expect(await storage.get('save')).toBeNull();
  });

  it('writes at once, before the returned promise is awaited', () => {
    const fake = new FakeLocalStorage();
    const storage = new WebStorage(() => asStorage(fake));
    void storage.set('save', 'now');
    expect(fake.data.get('save')).toBe('now');
  });

  it('degrades to memory when the storage cannot be reached', async () => {
    const storage = new WebStorage(() => {
      throw new Error('blocked');
    });
    await expect(storage.get('save')).resolves.toBeNull();
    await storage.set('save', 'kept');
    expect(await storage.get('save')).toBe('kept');
    await storage.remove('save');
    expect(await storage.get('save')).toBeNull();
  });

  it('degrades to memory when every call throws (private mode, quota)', async () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    const storage = new WebStorage(() => broken);
    await storage.set('a', '1');
    expect(await storage.get('a')).toBe('1');
    await expect(storage.remove('a')).resolves.toBeUndefined();
    expect(await storage.get('a')).toBeNull();
  });

  it('works without any storage object', async () => {
    const storage = new WebStorage(() => null);
    await storage.set('a', '1');
    expect(await storage.get('a')).toBe('1');
  });
});
