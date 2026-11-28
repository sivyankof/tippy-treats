import { describe, expect, it } from 'vitest';
import { STUB_KEYS, WebCloudSave, isWebCloudMode, type StubPage, type WebCloudMode } from './web';

function page(): StubPage & { items: Map<string, string>; fire: (key: string) => void } {
  const items = new Map<string, string>();
  const listeners = new Set<(key: string | null) => void>();
  return {
    items,
    storage: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
    },
    onStorage: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    wait: () => Promise.resolve(),
    fire: (key) => listeners.forEach((listener) => listener(key)),
  };
}

const make = (mode: WebCloudMode, p = page()) => ({ cloud: new WebCloudSave(mode, null, p), p });

describe('WebCloudSave', () => {
  it('knows its modes', () => {
    expect(['none', 'on', 'off', 'fail', 'slow'].every(isWebCloudMode)).toBe(true);
    expect(isWebCloudMode('yes')).toBe(false);
    expect(isWebCloudMode(null)).toBe(false);
  });

  it('has no cloud without a mode, and none when iCloud is off', async () => {
    expect(await make('none').cloud.available()).toBe(false);
    expect(await make('off').cloud.available()).toBe(false);
    expect(await make('off').cloud.write('x')).toBe(false);
  });

  it('keeps the copy under its own keys, the previous copy under the second', async () => {
    const { cloud, p } = make('on');
    expect(await cloud.available()).toBe(true);
    expect(await cloud.read()).toBeNull();
    expect(await cloud.write('one')).toBe(true);
    expect(await cloud.write('two', 'one')).toBe(true);
    expect(await cloud.read()).toBe('two');
    expect(p.items.get(STUB_KEYS.copy)).toBe('two');
    expect(p.items.get(STUB_KEYS.previous)).toBe('one');
    expect(p.items.has('save')).toBe(false);
  });

  it('fails reads and writes in the failing mode', async () => {
    const { cloud } = make('fail');
    expect(await cloud.available()).toBe(true);
    await expect(cloud.read()).rejects.toThrow();
    expect(await cloud.write('x')).toBe(false);
  });

  it('answers the read late in the slow mode', async () => {
    const p = page();
    let waited = 0;
    p.wait = (ms) => {
      waited = ms;
      return Promise.resolve();
    };
    const { cloud } = make('slow', p);
    await cloud.write('x');
    expect(await cloud.read()).toBe('x');
    expect(waited).toBeGreaterThan(0);
  });

  it('tells a change of the copy in another tab, and nothing else', () => {
    const { cloud, p } = make('on');
    let calls = 0;
    const off = cloud.onRemoteChange(() => (calls += 1));
    p.fire(STUB_KEYS.copy);
    p.fire('save');
    p.fire(STUB_KEYS.previous);
    expect(calls).toBe(1);
    off();
    p.fire(STUB_KEYS.copy);
    expect(calls).toBe(1);
  });

  it('lives in the page memory without a storage', async () => {
    const p = page();
    p.storage = null;
    const { cloud } = make('on', p);
    await cloud.write('kept');
    expect(await cloud.read()).toBe('kept');
  });
});
