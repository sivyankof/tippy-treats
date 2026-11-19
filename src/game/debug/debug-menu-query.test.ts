import { describe, expect, it } from 'vitest';
import {
  parseDebugParams,
  parsePerfParams,
  savesRun,
  showsFpsMeter,
} from '../../util/debug-params';
import {
  composeRunQuery,
  DEFAULT_MENU_CHOICE,
  PERF_QUERY,
  START_OPTIONS,
} from './debug-menu-query';

describe('composeRunQuery', () => {
  it('always carries the start height', () => {
    expect(composeRunQuery(DEFAULT_MENU_CHOICE)).toBe('start=0');
  });

  it('composes every choice into one query that the game reads back', () => {
    const query = composeRunQuery({
      startHeight: 60,
      place: 'shop',
      weather: 'storm',
      fps: true,
      panel: true,
    });
    const params = parseDebugParams(`?${query}`);
    expect(params).toMatchObject({ start: 60, place: 'shop', weather: 'storm', debug: true });
    expect(showsFpsMeter(`?${query}`)).toBe(true);
    expect(savesRun(params)).toBe(false);
  });

  it('offers the start of every zone, the checkpoint ones marked', () => {
    expect(START_OPTIONS.map((o) => o.height)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(START_OPTIONS.filter((o) => o.checkpoint).map((o) => o.height)).toEqual([
      20, 40, 60, 80, 100,
    ]);
  });

  it('keeps the benchmark queries valid', () => {
    expect(parsePerfParams(`?${PERF_QUERY.noTeam}`)?.mastery).toBeUndefined();
    expect(parsePerfParams(`?${PERF_QUERY.masterTeam}`)?.mastery).toBe('master');
  });
});
