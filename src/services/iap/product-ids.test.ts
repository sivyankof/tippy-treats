import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCT_KEYS } from '../../data/economy/shop';
import { ProductIds } from './product-ids';

/** An App Store product id is unique across the developer account, so the ids carry the game's prefix. */
const STORE_ID_PREFIX = 'tippy_';

describe('ProductIds', () => {
  it('maps keys to store ids and back', () => {
    const ids = new ProductIds({ remove_ads: 'com.example.noads', berries_80: ' b80 ' });
    expect(ids.idOf('remove_ads')).toBe('com.example.noads');
    expect(ids.idOf('berries_80')).toBe('b80');
    expect(ids.keyOf('com.example.noads')).toBe('remove_ads');
    expect(ids.keysOf(['b80', 'unknown', 'com.example.noads'])).toEqual([
      'berries_80',
      'remove_ads',
    ]);
  });

  it('treats a missing, blank or non-text id as no product', () => {
    const ids = new ProductIds({ remove_ads: '', starter_pack: undefined, berries_500: 5 });
    expect(ids.idOf('remove_ads')).toBeNull();
    expect(ids.idOf('starter_pack')).toBeNull();
    expect(ids.idOf('berries_500')).toBeNull();
    expect(ids.idOf('berries_1200')).toBeNull();
  });

  it('keeps a shared id for the first product only', () => {
    const ids = new ProductIds({ berries_80: 'same', berries_500: 'same' });
    expect(ids.idOf('berries_80')).toBe('same');
    expect(ids.idOf('berries_500')).toBeNull();
    expect(ids.keyOf('same')).toBe('berries_80');
  });
});

describe('.env.example', () => {
  it('names every product with the store id of App Store Connect: the key with the game prefix', () => {
    const text = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
    const ids = Object.fromEntries(
      [...text.matchAll(/^VITE_IAP_([A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2]?.trim()]),
    );
    for (const key of PRODUCT_KEYS) {
      expect(ids[key.toUpperCase()]).toBe(`${STORE_ID_PREFIX}${key}`);
    }
    expect(Object.keys(ids)).toHaveLength(PRODUCT_KEYS.length);
  });
});
