import { afterEach, describe, expect, it } from 'vitest';
import { detectLang, DICTIONARIES, formatNumber, keysOf, setLang, t, tn } from './index';

describe('i18n', () => {
  afterEach(() => setLang('en'));

  it('has the same keys in en and ru', () => {
    expect(keysOf(DICTIONARIES.ru)).toEqual(keysOf(DICTIONARIES.en));
  });

  it('translates dotted keys in the current language', () => {
    expect(t('run.playAgain')).toBe('Play again');
    setLang('ru');
    expect(t('run.playAgain')).toBe('Ещё раз');
  });

  it('returns the key itself for an unknown key', () => {
    expect(t('run.nope')).toBe('run.nope');
    expect(t('run')).toBe('run');
  });

  it('fills placeholders and leaves unknown ones as they are', () => {
    DICTIONARIES.en['probe'] = '{n} of {total} {x}';
    expect(t('probe', { n: 3, total: 12 })).toBe('3 of 12 {x}');
    delete DICTIONARIES.en['probe'];
  });

  it('follows the first (system) locale only', () => {
    expect(detectLang(['ru-RU', 'en-US'])).toBe('ru');
    expect(detectLang(['RU'])).toBe('ru');
    expect(detectLang(['en-US', 'ru-RU'])).toBe('en');
    expect(detectLang(['de-DE'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('groups thousands for the current language', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(3250)).toBe('3,250');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(-3250)).toBe('-3,250');
    setLang('ru');
    expect(formatNumber(3250)).toBe('3 250');
    expect(formatNumber(1250.4)).toBe('1 250');
  });

  it('picks the plural form of the language', () => {
    DICTIONARIES.en['probe'] = 'one={n} layer|other={n} layers';
    DICTIONARIES.ru['probe'] = 'one={n} слой|few={n} слоя|other={n} слоёв';
    expect(tn('probe', 1)).toBe('1 layer');
    expect(tn('probe', 2)).toBe('2 layers');
    setLang('ru');
    expect([1, 2, 4, 5, 11, 21, 22, 25].map((n) => tn('probe', n))).toEqual([
      '1 слой',
      '2 слоя',
      '4 слоя',
      '5 слоёв',
      '11 слоёв',
      '21 слой',
      '22 слоя',
      '25 слоёв',
    ]);
    delete DICTIONARIES.en['probe'];
    delete DICTIONARIES.ru['probe'];
  });

  it('falls back to the other form, then to the last one, then to the plain text', () => {
    DICTIONARIES.en['probe'] = 'one=a|other=b';
    expect(tn('probe', 0)).toBe('b');
    DICTIONARIES.en['probe'] = 'one=only';
    expect(tn('probe', 5)).toBe('only');
    DICTIONARIES.en['probe'] = 'plain {n}';
    expect(tn('probe', 5)).toBe('plain 5');
    delete DICTIONARIES.en['probe'];
  });
});
