import { describe, expect, it } from 'vitest';
import { TextureRefCache } from './texture-ref-cache';

function evicted(cache: TextureRefCache): string[] {
  const gone: string[] = [];
  cache.evict((key) => gone.push(key));
  return gone;
}

describe('TextureRefCache', () => {
  it('keeps a key while any of several users holds it', () => {
    const cache = new TextureRefCache(0);
    cache.acquire('a');
    cache.acquire('a');
    cache.release('a');
    expect(evicted(cache)).toEqual([]);
    expect(cache.isHeld('a')).toBe(true);
    cache.release('a');
    expect(evicted(cache)).toEqual(['a']);
  });

  it('takes a key again after it was shown with the same key (re-place)', () => {
    const cache = new TextureRefCache(0);
    cache.acquire('a');
    cache.acquire('a');
    cache.release('a');
    expect(cache.isHeld('a')).toBe(true);
  });

  it('ignores a release of an unknown key and a second release of a free one', () => {
    const cache = new TextureRefCache(0);
    cache.release('ghost');
    cache.acquire('a');
    cache.release('a');
    cache.release('a');
    cache.acquire('a');
    expect(cache.isHeld('a')).toBe(true);
    expect(evicted(cache)).toEqual([]);
  });

  it('evicts the oldest unused keys first and keeps `idleLimit` of them', () => {
    const cache = new TextureRefCache(2);
    for (const key of ['a', 'b', 'c', 'd']) {
      cache.acquire(key);
      cache.release(key);
    }
    expect(evicted(cache)).toEqual(['a', 'b']);
    expect(evicted(cache)).toEqual([]);
  });

  it('counts a key used again as the newest', () => {
    const cache = new TextureRefCache(1);
    for (const key of ['a', 'b']) {
      cache.acquire(key);
      cache.release(key);
    }
    cache.acquire('a');
    cache.release('a');
    expect(evicted(cache)).toEqual(['b']);
  });

  it('removes nothing until evict is called, and never a held key', () => {
    const cache = new TextureRefCache(0);
    cache.acquire('held');
    cache.acquire('idle');
    cache.release('idle');
    expect(cache.isHeld('idle')).toBe(false);
    expect(evicted(cache)).toEqual(['idle']);
    expect(cache.isHeld('held')).toBe(true);
  });
});
