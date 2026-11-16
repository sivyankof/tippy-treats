import { describe, expect, it } from 'vitest';
import {
  cleanBuildHash,
  formatBuildStamp,
  formatBuildTime,
  UNKNOWN_BUILD_HASH,
} from './build-stamp';

describe('build stamp', () => {
  it('formats the time as UTC yyyy-mm-dd HH:MM', () => {
    expect(formatBuildTime(new Date('2026-11-16T09:05:59.000Z'))).toBe('2026-11-16 09:05 UTC');
  });

  it('keeps a short git hash and trims the newline', () => {
    expect(cleanBuildHash('e6c2dbc\n')).toBe('e6c2dbc');
  });

  it('falls back to unknown when git gave nothing usable', () => {
    expect(cleanBuildHash('')).toBe(UNKNOWN_BUILD_HASH);
    expect(cleanBuildHash(null)).toBe(UNKNOWN_BUILD_HASH);
    expect(cleanBuildHash('fatal: not a git repository')).toBe(UNKNOWN_BUILD_HASH);
  });

  it('joins the hash and the time', () => {
    expect(formatBuildStamp('e6c2dbc', '2026-11-16 09:05 UTC')).toBe('e6c2dbc, 2026-11-16 09:05 UTC');
  });
});
