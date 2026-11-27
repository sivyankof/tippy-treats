import { afterEach, describe, expect, it } from 'vitest';
import { climbMap, type ClimbMapInput } from '../../../../core/progression/climb-map';
import { setLang } from '../../../../i18n';
import { bandName, goalText } from './climb-map-text';

const base: ClimbMapInput = { record: null, todayBest: 0, checkpoints: [], bestLap: 0 };
const goal = (record: number | null, lang: 'ru' | 'en'): string => {
  setLang(lang);
  return goalText(climbMap({ ...base, record }));
};

afterEach(() => setLang('en'));

describe('climb map texts', () => {
  it('words the goal with the plural of the layers in Russian', () => {
    expect(goal(null, 'ru')).toBe('До «Витрины»: 21 слой');
    expect(goal(47, 'ru')).toBe('До «Облаков»: 14 слоёв');
    expect(goal(58, 'ru')).toBe('До «Облаков»: 3 слоя');
    expect(goal(20, 'ru')).toBe('До «Витрины»: 1 слой');
  });

  it('names the next zone in each case of the ladder', () => {
    expect(goal(30, 'ru')).toBe('До «Крыши»: 11 слоёв');
    expect(goal(70, 'ru')).toBe('До «Звёзд»: 11 слоёв');
    expect(goal(90, 'ru')).toBe('До «Космоса»: 11 слоёв');
    expect(goal(105, 'ru')).toBe('До витка 2: 16 слоёв');
    expect(goal(133, 'ru')).toBe('До витка 3: 8 слоёв');
  });

  it('words the goal in English', () => {
    expect(goal(47, 'en')).toBe('14 layers to Clouds');
    expect(goal(20, 'en')).toBe('1 layer to Shop Window');
    expect(goal(105, 'en')).toBe('16 layers to lap 2');
    expect(goal(90, 'en')).toBe('11 layers to Space');
  });

  it('names the bands', () => {
    setLang('ru');
    const { bands } = climbMap({ ...base, record: 150 });
    expect(bands.map(bandName)).toEqual([
      'Кухня',
      'Витрина',
      'Крыша',
      'Облака',
      'Звёзды',
      'Космос',
      'Виток 2',
      'Виток 3',
      'Виток 4',
    ]);
  });

  it('gives no text without a target band', () => {
    const map = climbMap(base);
    expect(goalText({ ...map, goal: { band: 99, layers: 1 } })).toBe('');
  });
});
