import { describe, expect, it } from 'vitest';
import { DEFAULT_MUSIC_VARIANT, MUSIC_VARIANTS, musicVariantOf } from './songs';

describe('musicVariantOf', () => {
  it('takes a known variant and falls back to the default otherwise', () => {
    for (const variant of MUSIC_VARIANTS) expect(musicVariantOf(variant)).toBe(variant);
    expect(musicVariantOf('x')).toBe(DEFAULT_MUSIC_VARIANT);
    expect(musicVariantOf('')).toBe(DEFAULT_MUSIC_VARIANT);
    expect(musicVariantOf(null)).toBe(DEFAULT_MUSIC_VARIANT);
    expect(musicVariantOf('A')).toBe(DEFAULT_MUSIC_VARIANT);
  });
});
