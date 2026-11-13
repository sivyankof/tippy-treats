import { describe, expect, it } from 'vitest';
import { parseDebugParams } from './debug-params';

describe('parseDebugParams', () => {
  it('is off for an empty query', () => {
    expect(parseDebugParams('')).toEqual({ debug: false });
  });

  it('accepts a bare or valued debug flag', () => {
    expect(parseDebugParams('?debug').debug).toBe(true);
    expect(parseDebugParams('?debug=1').debug).toBe(true);
    expect(parseDebugParams('?debug=0').debug).toBe(false);
  });

  it('reads seed, bot and start', () => {
    expect(parseDebugParams('?debug=1&seed=42&bot=35.5&start=20')).toEqual({
      debug: true,
      seed: 42,
      bot: 35.5,
      start: 20,
    });
  });

  it('ignores invalid values', () => {
    expect(parseDebugParams('?seed=-1&bot=0&start=1.5')).toEqual({ debug: false });
    expect(parseDebugParams('?seed=abc&bot=x&start=')).toEqual({ debug: false });
    expect(parseDebugParams('?seed=4294967296')).toEqual({ debug: false });
  });

  it('keeps the largest uint32 seed', () => {
    expect(parseDebugParams('?seed=4294967295').seed).toBe(4294967295);
  });
});
