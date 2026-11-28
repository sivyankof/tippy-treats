import { describe, expect, it, vi } from 'vitest';
import { CLOUD } from '../../data/app/cloud';
import { NativeCloudSave, type CloudPlugin } from './native';

function plugin(over: Partial<CloudPlugin> = {}) {
  let emit: (data: { reason?: string }) => void = () => undefined;
  const remove = vi.fn(() => Promise.resolve());
  const p: CloudPlugin = {
    cloudAvailable: vi.fn(() => Promise.resolve({ available: true })),
    cloudRead: vi.fn(() => Promise.resolve({ text: 'copy' })),
    cloudWrite: vi.fn(() => Promise.resolve({ ok: true })),
    addListener: vi.fn((_event, listener) => {
      emit = listener;
      return Promise.resolve({ remove });
    }),
    ...over,
  };
  return { p, remove, emit: (reason = 'server') => emit({ reason }) };
}

describe('NativeCloudSave', () => {
  it('asks the plugin whether iCloud is there; a failure is no iCloud', async () => {
    expect(await new NativeCloudSave(plugin().p).available()).toBe(true);
    const off = plugin({ cloudAvailable: vi.fn(() => Promise.resolve({ available: false })) });
    expect(await new NativeCloudSave(off.p).available()).toBe(false);
    const broken = plugin({ cloudAvailable: vi.fn(() => Promise.reject(new Error('no plugin'))) });
    expect(await new NativeCloudSave(broken.p).available()).toBe(false);
  });

  it('reads the one key; no value is null; a failure rejects', async () => {
    const { p } = plugin();
    expect(await new NativeCloudSave(p).read()).toBe('copy');
    expect(p.cloudRead).toHaveBeenCalledWith({ key: CLOUD.keys.copy });
    const empty = plugin({ cloudRead: vi.fn(() => Promise.resolve({})) });
    expect(await new NativeCloudSave(empty.p).read()).toBeNull();
    const broken = plugin({ cloudRead: vi.fn(() => Promise.reject(new Error('store'))) });
    await expect(new NativeCloudSave(broken.p).read()).rejects.toThrow('store');
  });

  it('writes the copy, and the previous one to the second key when given', async () => {
    const { p } = plugin();
    const cloud = new NativeCloudSave(p);
    expect(await cloud.write('new')).toBe(true);
    expect(p.cloudWrite).toHaveBeenLastCalledWith({ key: CLOUD.keys.copy, text: 'new' });
    expect(await cloud.write('new', 'old')).toBe(true);
    expect(p.cloudWrite).toHaveBeenLastCalledWith({
      key: CLOUD.keys.copy,
      text: 'new',
      previousKey: CLOUD.keys.previous,
      previous: 'old',
    });
  });

  it('answers false when the write fails or throws', async () => {
    const refused = plugin({ cloudWrite: vi.fn(() => Promise.resolve({ ok: false })) });
    expect(await new NativeCloudSave(refused.p).write('x')).toBe(false);
    const broken = plugin({ cloudWrite: vi.fn(() => Promise.reject(new Error('x'))) });
    expect(await new NativeCloudSave(broken.p).write('x')).toBe(false);
  });

  it('passes the change events on until unsubscribed', async () => {
    const { p, emit, remove } = plugin();
    const cloud = new NativeCloudSave(p);
    let calls = 0;
    const off = cloud.onRemoteChange(() => (calls += 1));
    await Promise.resolve();
    emit();
    expect(calls).toBe(1);
    off();
    emit();
    expect(calls).toBe(1);
    expect(remove).toHaveBeenCalled();
  });

  it('passes on only data from the servers', async () => {
    const { p, emit } = plugin();
    let calls = 0;
    new NativeCloudSave(p).onRemoteChange(() => (calls += 1));
    await Promise.resolve();
    emit('initial');
    emit('server');
    emit('account');
    emit('unknown');
    expect(calls).toBe(2);
  });

  it('survives a plugin that cannot listen', () => {
    const broken = plugin({
      addListener: vi.fn(() => {
        throw new Error('no plugin');
      }),
    });
    expect(() => new NativeCloudSave(broken.p).onRemoteChange(() => undefined)()).not.toThrow();
  });
});
