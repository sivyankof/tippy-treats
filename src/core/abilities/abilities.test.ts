import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import type { CreatureId } from '../../data/creatures';
import { config, mutable } from '../sim-test-utils';
import type { PlacedLayer, SimEvent, TowerState } from '../sim-types';
import { TowerSim } from '../tower-sim';
import { ABILITIES } from './registry';
import { runAbility, tickRunEffects } from './run';
import type { ActiveEffect } from './types';

const LEVELS = [1, 2, 3, 4, 5] as const;

interface Fired {
  state: TowerState;
  events: SimEvent[];
  layer: PlacedLayer;
  effect: ActiveEffect | undefined;
}

/** Fires an ability on a fresh state, the creature layer being 300 wide. */
function fire(
  creature: CreatureId,
  level: number,
  boosted: boolean,
  tweak: (state: TowerState, layer: PlacedLayer) => void = () => undefined,
): Fired {
  const state = mutable(new TowerSim(config()));
  const layer: PlacedLayer = { x: 540, width: 300, kind: 'creature', quality: 'normal', creature };
  state.layers.push(layer);
  tweak(state, layer);
  const events: SimEvent[] = [];
  runAbility(state, (e) => events.push(e), layer, creature, level, boosted);
  return { state, events, layer, effect: state.effects.find((e) => e.id === creature) };
}

const abilityEvent = (events: SimEvent[]) => {
  const found = events.filter((e) => e.type === 'ability');
  expect(found).toHaveLength(1);
  return found[0] as Extract<SimEvent, { type: 'ability' }>;
};

/** [layers, value] of a started effect for levels 1..5, as written in docs/03-creatures.md. */
type Row = readonly [layers: number, value: number];

function checkEffect(creature: CreatureId, normal: readonly Row[], boosted: readonly Row[]): void {
  describe(`${creature} effect`, () => {
    it.each(LEVELS)('level %i, normal drop', (level) => {
      const [layers, value] = normal[level - 1] as Row;
      const { effect, events } = fire(creature, level, false);
      expect(effect).toMatchObject({ id: creature, layersLeft: layers, level, boosted: false });
      expect(effect?.value).toBeCloseTo(value, 10);
      const event = abilityEvent(events);
      expect(event).toMatchObject({ creature, boosted: false, payload: { layers } });
    });

    it.each(LEVELS)('level %i, perfect drop', (level) => {
      const [layers, value] = boosted[level - 1] as Row;
      const { effect, events } = fire(creature, level, true);
      expect(effect).toMatchObject({ layersLeft: layers, level, boosted: true });
      expect(effect?.value).toBeCloseTo(value, 10);
      expect(abilityEvent(events)).toMatchObject({ boosted: true, payload: { layers } });
    });
  });
}

describe('abilities: effects of every level', () => {
  checkEffect(
    'honey',
    [
      [3, 34],
      [3, 38],
      [3, 42],
      [3, 46],
      [3, 52],
    ],
    [
      [5, 34],
      [5, 38],
      [5, 42],
      [5, 46],
      [5, 52],
    ],
  );
  checkEffect(
    'caramel',
    [
      [8, 1],
      [10, 1],
      [12, 1],
      [14, 1],
      [18, 1],
    ],
    [
      [12, 1],
      [15, 1],
      [18, 1],
      [21, 1],
      [27, 1],
    ],
  );
  checkEffect(
    'frosty',
    [
      [3, 0.8],
      [3, 0.76],
      [3, 0.72],
      [3, 0.68],
      [3, 0.62],
    ],
    [
      [5, 0.8],
      [5, 0.76],
      [5, 0.72],
      [5, 0.68],
      [5, 0.62],
    ],
  );
  checkEffect(
    'sprinkle',
    [
      [5, 2],
      [5, 2.25],
      [5, 2.5],
      [5, 2.75],
      [5, 3],
    ],
    [
      [8, 2],
      [8, 2.25],
      [8, 2.5],
      [8, 2.75],
      [8, 3],
    ],
  );
  checkEffect(
    'crumb',
    [
      [6, 24],
      [6, 20],
      [6, 16],
      [6, 13],
      [6, 10],
    ],
    [
      [9, 24],
      [9, 20],
      [9, 16],
      [9, 13],
      [9, 10],
    ],
  );
  checkEffect(
    'ghost',
    [
      [3, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
    ],
    [
      [5, 0],
      [5, 0],
      [6, 0],
      [8, 0],
      [9, 0],
    ],
  );
  // The lemon boost grows the multiplier, not the duration.
  checkEffect(
    'lemon',
    [
      [4, 3],
      [4, 3.5],
      [4, 4],
      [4, 4.5],
      [4, 5],
    ],
    [
      [4, 4.5],
      [4, 5.25],
      [4, 6],
      [4, 6.75],
      [4, 7.5],
    ],
  );
  // The rainbow boost adds one drop instead of scaling.
  checkEffect(
    'rainbow',
    [
      [1, 0],
      [1, 0],
      [2, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [2, 0],
      [2, 0],
      [3, 0],
      [3, 0],
      [4, 0],
    ],
  );
});

describe('abilities: instant ones', () => {
  it.each([
    [1, 40, 60],
    [2, 50, 75],
    [3, 60, 90],
    [4, 75, 112.5],
    [5, 100, 150],
  ])('jelly level %i takes %d wobble, %d when perfect', (level, normal, perfect) => {
    const start = (state: TowerState) => void (state.wobble = 100);
    const plain = fire('jelly', level, false, start);
    expect(plain.state.wobble).toBe(100 - normal);
    expect(abilityEvent(plain.events).payload).toEqual({
      wobbleBefore: 100,
      wobbleAfter: 100 - normal,
    });
    const boosted = fire('jelly', level, true, start);
    expect(boosted.state.wobble).toBe(Math.max(0, 100 - perfect));
  });

  it('jelly never takes the wobble below zero', () => {
    const { state, events } = fire('jelly', 5, true, (s) => void (s.wobble = 10));
    expect(state.wobble).toBe(0);
    expect(abilityEvent(events).payload).toEqual({ wobbleBefore: 10, wobbleAfter: 0 });
  });

  it.each([
    [1, 50, 75],
    [2, 60, 90],
    [3, 70, 105],
    [4, 80, 120],
    [5, 100, 150],
  ])('puff level %i widens by %d, %d when perfect', (level, normal, perfect) => {
    const plain = fire('puff', level, false);
    expect(plain.layer.width).toBe(300 + normal);
    expect(abilityEvent(plain.events).payload).toEqual({ widened: normal });
    expect(fire('puff', level, true).layer.width).toBe(300 + perfect);
  });

  it('puff stops at the maximum width and reports what it actually added', () => {
    const { layer, events } = fire('puff', 5, true, (_s, l) => void (l.width = 700));
    expect(layer.width).toBe(BALANCE.layer.maxWidth);
    expect(abilityEvent(events).payload).toEqual({ widened: BALANCE.layer.maxWidth - 700 });
  });

  it('puff does not shrink a layer that is already wider than the maximum', () => {
    const { layer } = fire('puff', 1, false, (_s, l) => void (l.width = 800));
    expect(layer.width).toBe(800);
  });

  it.each([
    [1, 6, 9],
    [2, 8, 12],
    [3, 10, 15],
    [4, 12, 18],
    [5, 15, 23],
  ])('brownie level %i gives a shield of %d layers, %d when perfect', (level, normal, perfect) => {
    const plain = fire('brownie', level, false);
    expect(plain.state.shield).toBe(normal);
    expect(plain.effect).toBeUndefined();
    expect(abilityEvent(plain.events).payload).toEqual({ layers: normal });
    expect(fire('brownie', level, true).state.shield).toBe(perfect);
  });

  it('brownie keeps a longer shield that is still running', () => {
    expect(fire('brownie', 1, false, (s) => void (s.shield = 12)).state.shield).toBe(12);
    expect(fire('brownie', 1, false, (s) => void (s.shield = 2)).state.shield).toBe(6);
  });

  it.each([
    [1, 50, 75],
    [2, 80, 120],
    [3, 120, 180],
    [4, 170, 255],
    [5, 250, 375],
  ])(
    'twins level %i adds %d score, %d when perfect, and always one height',
    (level, normal, perfect) => {
      const plain = fire('twins', level, false, (s) => void (s.score = 7));
      expect(plain.state.score).toBe(7 + normal);
      expect(plain.state.bonusHeight).toBe(1);
      expect(abilityEvent(plain.events).payload).toEqual({ bonusScore: normal, bonusHeight: 1 });
      const boosted = fire('twins', level, true, (s) => void (s.score = 7));
      expect(boosted.state.score).toBe(7 + perfect);
      expect(boosted.state.bonusHeight).toBe(1);
    },
  );

  it('twins bonus is not touched by an active score multiplier', () => {
    const { state } = fire('twins', 1, false, (s) => {
      s.effects.push({ id: 'sprinkle', layersLeft: 3, level: 1, boosted: false, value: 3 });
    });
    expect(state.score).toBe(50);
  });
});

describe('abilities: levels', () => {
  it('clamps a level outside 1..5', () => {
    expect(fire('honey', 0, false).effect?.value).toBe(34);
    expect(fire('honey', 99, false).effect?.value).toBe(52);
    expect(fire('honey', 2.9, false).effect?.value).toBe(38);
    expect(fire('honey', 0, false).effect?.level).toBe(1);
    expect(fire('honey', 99, false).effect?.level).toBe(5);
    expect(fire('honey', 2.9, false).effect?.level).toBe(2);
  });

  it('has an ability for every creature, registered under its own id', () => {
    for (const [id, ability] of Object.entries(ABILITIES)) expect(ability.id).toBe(id);
  });
});

describe('abilities: modifiers of one effect', () => {
  const mods = (creature: CreatureId, level = 1, boosted = false) => {
    const { effect } = fire(creature, level, boosted);
    return effect ? ABILITIES[creature].modifiers?.(effect) : undefined;
  };

  it('maps each effect to its modifier', () => {
    expect(mods('honey', 3)).toEqual({ perfectTolerance: 42 });
    expect(mods('caramel')).toEqual({ coinMultAdd: 1 });
    expect(mods('frosty', 1)?.speedMult).toBeCloseTo(0.8);
    expect(mods('sprinkle', 5)).toEqual({ scoreMult: 3 });
    expect(mods('crumb', 4)).toEqual({ crumbToCoinsPx: 13 });
    expect(mods('ghost')).toEqual({ guides: true });
    expect(mods('rainbow')).toEqual({ autoPerfect: true });
    expect(mods('lemon', 2)).toEqual({ speedMult: 1.2, scoreMult: 3.5, perfectCoinAdd: 1 });
  });

  it('has no modifiers for the instant abilities', () => {
    for (const id of ['puff', 'jelly', 'brownie', 'twins'] as const) {
      expect(ABILITIES[id].modifiers).toBeUndefined();
    }
  });
});

describe('tickRunEffects', () => {
  it('counts down effects and the shield and reports what ended', () => {
    const state = mutable(new TowerSim(config()));
    state.effects.push(
      { id: 'honey', layersLeft: 2, level: 1, boosted: false, value: 34 },
      { id: 'ghost', layersLeft: 1, level: 1, boosted: false, value: 0 },
    );
    state.shield = 1;
    const events: SimEvent[] = [];
    tickRunEffects(state, (e) => events.push(e));
    expect(events).toEqual([
      { type: 'effect_end', effect: 'ghost' },
      { type: 'effect_end', effect: 'shield' },
    ]);
    expect(state.effects.map((e) => [e.id, e.layersLeft])).toEqual([['honey', 1]]);
    expect(state.shield).toBe(0);
  });

  it('does nothing without a shield or effects', () => {
    const state = mutable(new TowerSim(config()));
    const events: SimEvent[] = [];
    tickRunEffects(state, (e) => events.push(e));
    expect(events).toEqual([]);
    expect(state.shield).toBe(0);
  });
});
