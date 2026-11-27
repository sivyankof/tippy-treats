import { afterEach, describe, expect, it } from 'vitest';
import type { JournalCounts } from '../../../../core/progression/journal';
import { setLang } from '../../../../i18n';
import {
  fliesDish,
  fliesRank,
  journalAmount,
  journalBarText,
  journalLabel,
  journalPhrase,
} from './journal-text';

const ZERO: JournalCounts = { flies: 0, layers: 0, height: 0, glaze: 0, perfects: 0, runs: 0 };
const counts = (over: Partial<JournalCounts>): JournalCounts => ({ ...ZERO, ...over });
/** Thin space of the Russian thousands groups. */
const nb = (text: string): string => text.replace(/\s/g, ' ');

afterEach(() => setLang('en'));

describe('journal texts in Russian', () => {
  it('keeps the owner samples word for word', () => {
    setLang('ru');
    expect(nb(journalPhrase('flies', counts({ flies: 312 })))).toBe(
      '312 мушек. Это целый рой над вареньем',
    );
    expect(nb(journalPhrase('layers', counts({ layers: 4800 })))).toBe(
      '4 800 слоёв. Хватило бы накормить школу',
    );
    expect(journalPhrase('height', counts({ height: 27 }))).toBe(
      'Все твои башни вместе выше девятиэтажки',
    );
    expect(nb(journalPhrase('perfects', counts({ perfects: 1200 })))).toBe(
      'Рука не дрогнула 1 200 раз',
    );
    expect(journalPhrase('runs', counts({ runs: 340 }))).toBe(
      'Уронено 340 башен. Уборщица передаёт привет',
    );
    expect(fliesDish(counts({ flies: 60 })).caption).toBe('50 мушек: это один стакан');
  });

  it('agrees the words with the number', () => {
    setLang('ru');
    expect(journalPhrase('runs', counts({ runs: 1 }))).toBe('Уронена 1 башня. Пол пока сияет');
    expect(journalPhrase('runs', counts({ runs: 3 }))).toBe('Уронены 3 башни. Пол пока сияет');
    expect(journalPhrase('flies', counts({ flies: 21 }))).toBe('21 мушка. Пока только разведка');
    expect(journalPhrase('perfects', counts({ perfects: 2 }))).toBe(
      'Рука не дрогнула 2 раза. Лиха беда начало',
    );
    expect(journalPhrase('glaze', counts({ glaze: 1.5 }))).toBe(
      '1,5 литра глазури. Пока на донышке кружки',
    );
    expect(journalPhrase('glaze', counts({ glaze: 150 }))).toBe('150 литров глазури. Это ванна');
    expect(journalPhrase('glaze', counts({ glaze: 11.4 }))).toBe(
      '11 литров глазури. Это целое ведро',
    );
    expect(journalPhrase('glaze', counts({ glaze: 21.2 }))).toBe(
      '21 литр глазури. Это целое ведро',
    );
  });

  it('writes metres, kilometres and litres', () => {
    setLang('ru');
    expect(journalAmount('height', 4.25)).toBe('4,3 м');
    expect(journalAmount('height', 330)).toBe('330 м');
    expect(journalAmount('height', 8849)).toBe('8,8 км');
    expect(journalAmount('glaze', 0.3)).toBe('0,3 л');
    expect(journalPhrase('height', counts({ height: 2.5 }))).toBe(
      'Все твои башни вместе: 2,5 м. Жираф пока смотрит свысока',
    );
  });
});

describe('journal texts in English', () => {
  it('names the rank, the dish and the bar by the tier', () => {
    expect(fliesRank(counts({ flies: 0 }))).toBe('Fly Spotter');
    expect(fliesRank(counts({ flies: 5000 }))).toBe('Kitchen Legend');
    expect(fliesDish(counts({ flies: 0 }))).toEqual({
      index: 1,
      caption: '50 flies: one full glass',
    });
    expect(fliesDish(counts({ flies: 700 })).index).toBe(2);
    expect(journalBarText('flies', counts({ flies: 312 }))).toBe('312 / 500');
    expect(journalBarText('height', counts({ height: 6 }))).toBe('6 m / 27 m');
    expect(journalBarText('runs', counts({ runs: 9999 }))).toBe('Top tier');
  });

  it('has a label and a phrase for every row and tier', () => {
    for (const id of ['layers', 'height', 'glaze', 'perfects', 'runs'] as const) {
      expect(journalLabel(id)).not.toContain('journal.');
      for (const value of [0, 1, 2, 5, 11, 101, 501, 2001, 5001, 20001, 100001, 500000]) {
        expect(journalPhrase(id, counts({ [id]: value }))).not.toContain('journal.');
      }
    }
    expect(journalPhrase('layers', counts({ layers: 1 }))).toBe(
      '1 layer. Enough for a family tea party',
    );
  });
});
