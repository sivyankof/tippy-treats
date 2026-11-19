import { afterEach, describe, expect, it } from 'vitest';
import { abilityDef } from '../src/data/creatures/creatures';
import { MASTERY } from '../src/data/creatures/mastery';
import { applySets } from './what-if';

const frosty = abilityDef('frosty');
const jelly = abilityDef('jelly');
const honey = abilityDef('honey');
const saved = {
  slow: [...frosty.slowPercent],
  spring: [...jelly.springPercent],
  relief: [...jelly.relief],
  tolerance: [...honey.tolerance],
  rime: MASTERY.frosty.toleranceAdd,
};

afterEach(() => {
  Object.assign(frosty.slowPercent, saved.slow);
  Object.assign(jelly.springPercent, saved.spring);
  Object.assign(jelly.relief, saved.relief);
  Object.assign(honey.tolerance, saved.tolerance);
  applySets(`mastery.frosty.toleranceAdd=${saved.rime}`);
});

describe('applySets', () => {
  it('writes any levelled ability value by its field', () => {
    applySets('frosty.slowPercent.5=33;jelly.relief.5=80;jelly.springPercent.5=47');
    expect(frosty.slowPercent[4]).toBe(33);
    expect(jelly.relief[4]).toBe(80);
    expect(jelly.springPercent[4]).toBe(47);
    expect(frosty.slowPercent[3]).toBe(saved.slow[3]);
  });
  it('keeps the short form for the main levelled value', () => {
    applySets('honey.4=44');
    expect(honey.tolerance[3]).toBe(44);
  });
  it('writes mastery numbers', () => {
    applySets('mastery.frosty.toleranceAdd=12');
    expect(MASTERY.frosty.toleranceAdd).toBe(12);
  });
  it.each([
    'frosty.5=33',
    'frosty.layers.5=4',
    'frosty.slowPercent.6=33',
    'frosty.slowPercent.0=33',
    'frosty.nothing.5=33',
    'nobody.slowPercent.5=33',
    'frosty.slowPercent.5=x',
    'frosty.slowPercent.5.1=33',
  ])('refuses %s', (item) => {
    expect(() => applySets(item)).toThrow(/Invalid --set item/);
  });
});
