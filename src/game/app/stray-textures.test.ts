import { describe, expect, it } from 'vitest';
import { strayTextures } from './stray-textures';

describe('strayTextures', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const blank = { id: 'blank' };
  const context = { id: 'context' };

  it('returns the new wrappers the new texture does not hold', () => {
    expect(strayTextures([a, b], [a, b, blank, context], [context])).toEqual([blank]);
  });

  it('never returns a wrapper that was there before, even when it moved in the list', () => {
    expect(strayTextures([a, b], [b, blank, a, context], [context])).toEqual([blank]);
  });

  it('returns nothing when every new wrapper is kept (a Phaser without the extra texture)', () => {
    expect(strayTextures([a], [a, context], [context, context, null])).toEqual([]);
  });

  it('returns nothing when no wrapper was made (the canvas renderer)', () => {
    expect(strayTextures([], [], [undefined])).toEqual([]);
  });
});
