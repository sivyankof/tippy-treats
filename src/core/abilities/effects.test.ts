import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { addOrExtendEffect, tickEffects } from './effects';
import { collectModifiers } from './modifiers';
import { ABILITIES } from './registry';
import { BASE_MODIFIERS, type ActiveEffect, type CreatureId } from './types';

const effect = (id: CreatureId, value: number, layersLeft = 3, level = 1): ActiveEffect => ({
  id,
  layersLeft,
  level,
  boosted: false,
  value,
});

describe('addOrExtendEffect', () => {
  it('adds a new effect as a copy', () => {
    const effects: ActiveEffect[] = [];
    const added = effect('honey', 28);
    addOrExtendEffect(effects, added);
    expect(effects).toEqual([added]);
    expect(effects[0]).not.toBe(added);
  });

  it('never stacks the same creature: the longer duration and the larger value win', () => {
    const effects = [effect('honey', 36, 2, 3)];
    addOrExtendEffect(effects, effect('honey', 28, 5, 1));
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ layersLeft: 5, value: 36, level: 3 });
    addOrExtendEffect(effects, effect('honey', 46, 1, 5));
    expect(effects[0]).toMatchObject({ layersLeft: 5, value: 46, level: 5 });
  });

  it('keeps the smaller value when a smaller one is stronger (frosty, crumb)', () => {
    const effects = [effect('crumb', 28, 2)];
    addOrExtendEffect(effects, effect('crumb', 40, 6), true);
    expect(effects[0]).toMatchObject({ layersLeft: 6, value: 28 });
    addOrExtendEffect(effects, effect('crumb', 18, 1), true);
    expect(effects[0]).toMatchObject({ layersLeft: 6, value: 18 });
  });

  it('remembers a boost and keeps different creatures apart', () => {
    const effects = [effect('honey', 28), effect('ghost', 0)];
    addOrExtendEffect(effects, { ...effect('honey', 28), boosted: true });
    expect(effects).toHaveLength(2);
    expect(effects[0]?.boosted).toBe(true);
  });
});

describe('tickEffects', () => {
  it('counts down and removes the finished ones in order', () => {
    const effects = [effect('honey', 1, 1), effect('ghost', 0, 2), effect('lemon', 3, 1)];
    expect(tickEffects(effects)).toEqual(['honey', 'lemon']);
    expect(effects.map((e) => [e.id, e.layersLeft])).toEqual([['ghost', 1]]);
    expect(tickEffects(effects)).toEqual(['ghost']);
    expect(effects).toEqual([]);
    expect(tickEffects(effects)).toEqual([]);
  });
});

describe('collectModifiers', () => {
  const collect = (...effects: ActiveEffect[]) => collectModifiers(effects, ABILITIES);

  it('is the base without effects', () => {
    expect(collect()).toEqual(BASE_MODIFIERS);
  });

  it('multiplies score and speed', () => {
    const mods = collect(effect('sprinkle', 2.5), effect('lemon', 4), effect('frosty', 0.8));
    expect(mods.scoreMult).toBe(10);
    expect(mods.speedMult).toBeCloseTo(1.2 * 0.8);
  });

  it('adds coin multipliers and flat perfect coins', () => {
    expect(collect(effect('caramel', 1)).coinMultAdd).toBe(1);
    expect(collect(effect('caramel', 1), effect('caramel', 1)).coinMultAdd).toBe(2);
    expect(collect(effect('lemon', 3)).perfectCoinAdd).toBe(1);
  });

  it('takes the widest tolerance and never goes below the base', () => {
    expect(collect(effect('honey', 36)).perfectTolerance).toBe(36);
    expect(collect(effect('honey', 5)).perfectTolerance).toBe(BALANCE.drop.perfectTolerance);
  });

  it('takes the smallest crumb size and or-s the flags', () => {
    expect(collect().crumbToCoinsPx).toBeNull();
    expect(collect(effect('crumb', 28)).crumbToCoinsPx).toBe(28);
    const both = collect(effect('crumb', 28), effect('crumb', 18, 1, 5));
    expect(both.crumbToCoinsPx).toBe(18);
    const flags = collect(effect('ghost', 0), effect('rainbow', 0));
    expect(flags).toMatchObject({ guides: true, autoPerfect: true });
  });

  it('ignores effects without modifiers and does not touch the base object', () => {
    expect(collect(effect('puff', 1))).toEqual(BASE_MODIFIERS);
    collect(effect('sprinkle', 3));
    expect(BASE_MODIFIERS.scoreMult).toBe(1);
  });

  it('uses the real registry by default', () => {
    expect(collectModifiers([effect('sprinkle', 3)]).scoreMult).toBe(3);
  });
});
