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

  it('reads the line-up flag only when it is 1', () => {
    expect(parseDebugParams('?lineup=1').lineup).toBe(true);
    expect(parseDebugParams('?lineup=0').lineup).toBeUndefined();
    expect(parseDebugParams('?lineup').lineup).toBeUndefined();
    expect(parseDebugParams('')).toEqual({ debug: false });
  });

  it('keeps the largest uint32 seed', () => {
    expect(parseDebugParams('?seed=4294967295').seed).toBe(4294967295);
  });

  it('reads the team with empty slots and drops unknown ids', () => {
    expect(parseDebugParams('?team=honey,jelly,brownie').team).toEqual([
      'honey',
      'jelly',
      'brownie',
    ]);
    expect(parseDebugParams('?team=honey,-,brownie').team).toEqual(['honey', null, 'brownie']);
    expect(parseDebugParams('?team=,puff').team).toEqual([null, 'puff']);
    expect(parseDebugParams('?team=honey,nope,jelly').team).toEqual(['honey', 'jelly']);
    expect(parseDebugParams('?team= honey , jelly ').team).toEqual(['honey', 'jelly']);
  });

  it('keeps at most three slots', () => {
    expect(parseDebugParams('?team=honey,puff,jelly,caramel').team).toEqual([
      'honey',
      'puff',
      'jelly',
    ]);
  });

  it('treats an empty team value as no creatures', () => {
    expect(parseDebugParams('?team=').team).toEqual([null]);
    expect(parseDebugParams('?debug=1').team).toBeUndefined();
  });

  it('reads the level only from 1 to 5', () => {
    expect(parseDebugParams('?level=1').level).toBe(1);
    expect(parseDebugParams('?level=5').level).toBe(5);
    expect(parseDebugParams('?level=0').level).toBeUndefined();
    expect(parseDebugParams('?level=6').level).toBeUndefined();
    expect(parseDebugParams('?level=2.5').level).toBeUndefined();
    expect(parseDebugParams('?level=x').level).toBeUndefined();
  });
});
