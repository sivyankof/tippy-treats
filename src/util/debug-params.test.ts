import { describe, expect, it } from 'vitest';
import {
  parseDebugParams,
  parsePerfParams,
  savesRun,
  showsFpsMeter,
  skipsTutorial,
  withoutReset,
} from './debug-params';

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

  it('reads the art sheet flag only when it is 1', () => {
    expect(parseDebugParams('?artsheet=1').artsheet).toBe(true);
    expect(parseDebugParams('?artsheet=0').artsheet).toBeUndefined();
    expect(parseDebugParams('?artsheet').artsheet).toBeUndefined();
  });

  it('reads the results demo case only when it is known', () => {
    expect(parseDebugParams('?resultsDemo=record').resultsDemo).toBe('record');
    expect(parseDebugParams('?resultsDemo=nope').resultsDemo).toBeUndefined();
    expect(parseDebugParams('').resultsDemo).toBeUndefined();
  });

  it('reads the tutorial switch only as 1 or 0', () => {
    expect(parseDebugParams('?tutorial=1').tutorial).toBe(true);
    expect(parseDebugParams('?tutorial=0').tutorial).toBe(false);
    expect(parseDebugParams('?tutorial=yes').tutorial).toBeUndefined();
    expect(parseDebugParams('?tutorial').tutorial).toBeUndefined();
    expect(parseDebugParams('')).toEqual({ debug: false });
  });

  it('reads a signed whole day offset', () => {
    expect(parseDebugParams('?dayOffset=3').dayOffset).toBe(3);
    expect(parseDebugParams('?dayOffset=-2').dayOffset).toBe(-2);
    expect(parseDebugParams('?dayOffset=0').dayOffset).toBe(0);
    expect(parseDebugParams('?dayOffset=1.5').dayOffset).toBeUndefined();
    expect(parseDebugParams('?dayOffset=x').dayOffset).toBeUndefined();
    expect(parseDebugParams('?dayOffset=99999').dayOffset).toBeUndefined();
    expect(parseDebugParams('?dayOffset').dayOffset).toBeUndefined();
  });

  it('reads the reset flag only when it is 1', () => {
    expect(parseDebugParams('?reset=1').reset).toBe(true);
    expect(parseDebugParams('?reset=0').reset).toBeUndefined();
    expect(parseDebugParams('?reset').reset).toBeUndefined();
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

describe('skipsTutorial', () => {
  it('is false for a plain query and for the tutorial switch', () => {
    expect(skipsTutorial(parseDebugParams(''))).toBe(false);
    expect(skipsTutorial(parseDebugParams('?debug=1&seed=7'))).toBe(false);
    expect(skipsTutorial(parseDebugParams('?tutorial=1'))).toBe(false);
  });

  it('is true when a team, level, bot or start is given without ?tutorial=', () => {
    for (const query of ['?team=honey', '?level=3', '?bot=35', '?start=10']) {
      expect(skipsTutorial(parseDebugParams(query))).toBe(true);
    }
  });

  it('lets ?tutorial= win over the other parameters', () => {
    expect(skipsTutorial(parseDebugParams('?team=honey&tutorial=1'))).toBe(false);
    expect(skipsTutorial(parseDebugParams('?start=10&tutorial=0'))).toBe(false);
  });
});

describe('savesRun', () => {
  it('skips the save for bot, start, team and level runs', () => {
    expect(savesRun(parseDebugParams(''))).toBe(true);
    expect(savesRun(parseDebugParams('?debug&seed=1'))).toBe(true);
    expect(savesRun(parseDebugParams('?tutorial=1'))).toBe(true);
    expect(savesRun(parseDebugParams('?team=honey&level=3'))).toBe(false);
    expect(savesRun(parseDebugParams('?team=honey'))).toBe(false);
    expect(savesRun(parseDebugParams('?level=3'))).toBe(false);
    expect(savesRun(parseDebugParams('?bot=50'))).toBe(false);
    expect(savesRun(parseDebugParams('?start=20'))).toBe(false);
    expect(savesRun(parseDebugParams('?team=honey&bot=50'))).toBe(false);
  });
});

describe('withoutReset', () => {
  it('drops only the reset parameter', () => {
    expect(withoutReset('http://localhost:5173/?debug&reset=1&seed=3#top')).toBe(
      'http://localhost:5173/?debug=&seed=3#top',
    );
    expect(withoutReset('http://localhost:5173/?reset=1')).toBe('http://localhost:5173/');
  });
});

describe('showsFpsMeter', () => {
  it('is on only for ?fps=1', () => {
    expect(showsFpsMeter('?fps=1')).toBe(true);
    expect(showsFpsMeter('?debug=1&fps=1')).toBe(true);
    expect(showsFpsMeter('')).toBe(false);
    expect(showsFpsMeter('?fps=0')).toBe(false);
    expect(showsFpsMeter('?fps')).toBe(false);
  });
});

describe('parsePerfParams', () => {
  it('is off without ?perf=1', () => {
    expect(parsePerfParams('')).toBeNull();
    expect(parsePerfParams('?perf=0')).toBeNull();
    expect(parsePerfParams('?perf')).toBeNull();
  });

  it('plays everything with full effects by default', () => {
    expect(parsePerfParams('?perf=1')).toEqual({ fx: 'full', only: null, still: null });
  });

  it('reads the effects level, the subset and the still', () => {
    expect(parsePerfParams('?perf=1&fx=lite&only=calm,edge&still=tongue')).toEqual({
      fx: 'lite',
      only: ['calm', 'edge'],
      still: 'lick-big',
    });
    expect(parsePerfParams('?perf=1&still=rainbow')?.still).toBe('rainbow');
  });

  it('takes the three effect levels and reduced as another name of minimal', () => {
    expect(parsePerfParams('?perf=1&fx=full')?.fx).toBe('full');
    expect(parsePerfParams('?perf=1&fx=lite')?.fx).toBe('lite');
    expect(parsePerfParams('?perf=1&fx=minimal')?.fx).toBe('minimal');
    expect(parsePerfParams('?perf=1&fx=reduced')?.fx).toBe('minimal');
  });

  it('drops unknown names', () => {
    expect(parsePerfParams('?perf=1&only=nope,space&fx=x&still=constructor')).toEqual({
      fx: 'full',
      only: ['space'],
      still: null,
    });
    expect(parsePerfParams('?perf=1&only=nope')?.only).toBeNull();
  });
});
