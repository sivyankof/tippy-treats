import { describe, expect, it } from 'vitest';
import { MemoryStorage } from './memory';
import { PrefixedStorage } from './prefixed';

describe('PrefixedStorage', () => {
  it('keeps its keys apart from the plain ones', async () => {
    const inner = new MemoryStorage();
    const b = new PrefixedStorage(inner, 'device_b:');
    await inner.set('save', 'a');
    await b.set('save', 'b');
    expect(await b.get('save')).toBe('b');
    expect(await inner.get('save')).toBe('a');
    expect(inner.keys()).toEqual(['save', 'device_b:save']);
    await b.remove('save');
    expect(await b.get('save')).toBeNull();
    expect(await inner.get('save')).toBe('a');
  });
});
