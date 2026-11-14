import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../../../i18n';
import { formatTimeLeft } from './time-text';

afterEach(() => setLang('en'));

describe('formatTimeLeft', () => {
  it('shows hours and minutes from an hour up', () => {
    setLang('en');
    expect(formatTimeLeft((3 * 3600 + 5 * 60) * 1000)).toBe('3 h 05 min');
  });

  it('shows minutes and seconds below an hour', () => {
    setLang('en');
    expect(formatTimeLeft((12 * 60 + 7) * 1000)).toBe('12 min 07 s');
  });

  it('shows seconds below a minute and rounds up', () => {
    setLang('en');
    expect(formatTimeLeft(44_100)).toBe('45 s');
    expect(formatTimeLeft(-5)).toBe('0 s');
  });

  it('speaks Russian', () => {
    setLang('ru');
    expect(formatTimeLeft(3600 * 1000)).toBe('1 ч 00 мин');
    expect(formatTimeLeft(65_000)).toBe('1 мин 05 с');
  });
});
