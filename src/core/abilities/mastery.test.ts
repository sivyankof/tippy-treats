import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import type { CreatureId } from '../../data/creatures';
import { MASTERY } from '../../data/mastery';
import { config, mutable } from '../sim-test-utils';
import type { PlacedLayer, SimEvent, TowerState } from '../sim-types';
import { TowerSim } from '../tower-sim';
import { collectModifiers, dropModifiers } from './modifiers';
import { ABILITIES } from './registry';
import { runAbility, runCloudHooks, runLandingHooks, runMissHooks, tickRunEffects } from './run';
import type { ActiveEffect, Landing } from './types';

interface Run {
  state: TowerState;
  events: SimEvent[];
  emit: (event: SimEvent) => void;
}

/** A fresh run state with the given effects and an event list. */
function run(...effects: ActiveEffect[]): Run {
  const state = mutable(new TowerSim(config()));
  state.effects.push(...effects);
  const events: SimEvent[] = [];
  return { state, events, emit: (event) => events.push(event) };
}

const effect = (
  id: CreatureId,
  level: number,
  layersLeft = 3,
  value = 0,
  boosted = false,
): ActiveEffect => ({ id, layersLeft, level, boosted, value });

const landing = (overrides: Partial<Landing> = {}): Landing => ({
  quality: 'perfect',
  pieceWidth: 0,
  flyingWidth: 400,
  golden: false,
  ...overrides,
});

const land = (r: Run, overrides: Partial<Landing> = {}): void =>
  runLandingHooks(r.state, r.emit, landing(overrides));

/** Fires the ability of a creature layer `width` wide at `level`. */
function fire(r: Run, creature: CreatureId, level: number, boosted = false, width = 300): void {
  const layer: PlacedLayer = { x: 540, width, kind: 'creature', quality: 'normal', creature };
  r.state.layers.push(layer);
  runAbility(r.state, r.emit, layer, creature, level, boosted);
}

const masteryEvents = (events: SimEvent[]) => events.filter((e) => e.type === 'mastery');
const masteryCoins = (events: SimEvent[]) =>
  events
    .filter((e) => e.type === 'coin_collect' && e.source === 'mastery')
    .reduce((sum, e) => sum + (e.type === 'coin_collect' ? e.amount : 0), 0);

describe('mastery: only at level 5', () => {
  it('does nothing for an effect of level 4', () => {
    for (const id of ['honey', 'sprinkle', 'rainbow', 'lemon', 'caramel'] as const) {
      const r = run(effect(id, 4, 1));
      land(r, { golden: true });
      land(r, { quality: 'normal', golden: true, pieceWidth: 300 });
      tickRunEffects(r.state, r.emit);
      expect(masteryEvents(r.events), id).toEqual([]);
      expect(r.state.coins, id).toBe(0);
    }
  });
});

describe('honey: Honey trail', () => {
  it('pays a flat coin for every perfect drop under the sticky effect', () => {
    const r = run(effect('honey', 5, 3, 48), effect('caramel', 1, 5, 1));
    land(r);
    land(r, { quality: 'normal' });
    expect(r.events).toEqual([
      { type: 'mastery', creature: 'honey', coins: MASTERY.honey.perfectCoins, score: 0 },
      { type: 'coin_collect', amount: MASTERY.honey.perfectCoins, source: 'mastery' },
    ]);
    expect(r.state.coins).toBe(1);
  });
});

describe('puff: Sugar dust', () => {
  it.each([
    [false, 300, 90],
    [true, 300, 135],
    [false, 700, 20],
  ])('boosted %s on a layer %d wide pays %d score', (boosted, width, score) => {
    const r = run();
    fire(r, 'puff', 5, boosted, width);
    expect(r.state.score).toBe(score * MASTERY.puff.scorePerPx);
    expect(masteryEvents(r.events)).toEqual([
      { type: 'mastery', creature: 'puff', coins: 0, score: score * MASTERY.puff.scorePerPx },
    ]);
  });

  it('pays nothing when the layer cannot grow or below level 5', () => {
    const full = run();
    fire(full, 'puff', 5, false, BALANCE.layer.maxWidth);
    const four = run();
    fire(four, 'puff', 4);
    expect(masteryEvents([...full.events, ...four.events])).toEqual([]);
    expect(full.state.score + four.state.score).toBe(0);
  });
});

describe('jelly: Long bounce', () => {
  it('leaves a one-layer tail with half the spring, then ends for good', () => {
    const r = run(effect('jelly', 5, 1, 0.55));
    tickRunEffects(r.state, r.emit);
    expect(r.events).toEqual([{ type: 'mastery', creature: 'jelly', coins: 0, score: 0 }]);
    expect(r.state.effects).toEqual([
      { id: 'jelly', layersLeft: 1, level: 5, boosted: false, value: 0.275, tail: true },
    ]);
    expect(collectModifiers(r.state.effects).springShare).toBeCloseTo(0.275, 10);
    r.events.length = 0;
    tickRunEffects(r.state, r.emit);
    expect(r.events).toEqual([{ type: 'effect_end', effect: 'jelly' }]);
    expect(r.state.effects).toEqual([]);
  });

  it('ends without a tail below level 5', () => {
    const r = run(effect('jelly', 4, 1, 0.45));
    tickRunEffects(r.state, r.emit);
    expect(r.events).toEqual([{ type: 'effect_end', effect: 'jelly' }]);
  });

  it('is replaced by a new spring when the jelly fires during the tail', () => {
    const r = run({ ...effect('jelly', 5, 1, 0.275), tail: true });
    fire(r, 'jelly', 5);
    expect(r.state.effects).toEqual([effect('jelly', 5, 4, 0.55)]);
  });
});

describe('caramel: Gold vein', () => {
  it('pays the golden coins of a normal drop three times, the extra from mastery', () => {
    const r = run(effect('caramel', 5, 5, 1));
    land(r, { quality: 'normal', golden: true });
    const extra = BALANCE.golden.normalCoins * (MASTERY.caramel.goldenCoinMult - 1);
    expect(masteryCoins(r.events)).toBe(extra);
    expect(extra).toBe(20);
  });

  it('leaves a perfect golden drop and plain layers alone', () => {
    const r = run(effect('caramel', 5, 5, 1));
    land(r, { golden: true });
    land(r, { quality: 'normal' });
    expect(r.events).toEqual([]);
  });
});

describe('frosty: Rime', () => {
  it('leaves a tail of normal speed with the base tolerance plus 10', () => {
    const r = run(effect('frosty', 5, 1, 0.62));
    tickRunEffects(r.state, r.emit);
    expect(r.events).toEqual([{ type: 'mastery', creature: 'frosty', coins: 0, score: 0 }]);
    const mods = collectModifiers(r.state.effects);
    expect(mods.perfectTolerance).toBe(BALANCE.drop.perfectTolerance + MASTERY.frosty.toleranceAdd);
    expect(mods.speedMult).toBe(1);
    r.events.length = 0;
    tickRunEffects(r.state, r.emit);
    expect(r.events).toEqual([{ type: 'effect_end', effect: 'frosty' }]);
  });

  it('takes the largest tolerance when the honey is wider', () => {
    const mods = collectModifiers([
      { ...effect('frosty', 5, 1, 0.62), tail: true },
      effect('honey', 5, 2, 48),
    ]);
    expect(mods.perfectTolerance).toBe(48);
  });
});

describe('brownie: Change', () => {
  it('remembers the level of the shield and pays when a level-5 shield saves a miss', () => {
    const r = run();
    fire(r, 'brownie', 5);
    expect(r.state.shieldLevel).toBe(5);
    r.events.length = 0;
    runMissHooks(r.state, r.emit, r.state.shieldLevel);
    expect(masteryCoins(r.events)).toBe(MASTERY.brownie.shieldCoins);
    expect(masteryEvents(r.events)).toHaveLength(1);
  });

  it('pays nothing for a shield of a lower level or a miss no shield saved', () => {
    const r = run();
    runMissHooks(r.state, r.emit, 4);
    runMissHooks(r.state, r.emit, null);
    expect(r.events).toEqual([]);
  });

  it('keeps the level of a shield that a new one does not outlast', () => {
    const r = run();
    r.state.shield = 13;
    r.state.shieldLevel = 5;
    fire(r, 'brownie', 1);
    expect(r.state).toMatchObject({ shield: 13, shieldLevel: 5 });
    fire(r, 'brownie', 4, true);
    expect(r.state).toMatchObject({ shield: 17, shieldLevel: 4 });
  });

  it('forgets the level when the shield runs out', () => {
    const r = run();
    r.state.shield = 1;
    r.state.shieldLevel = 5;
    tickRunEffects(r.state, r.emit);
    expect(r.state).toMatchObject({ shield: 0, shieldLevel: 0 });
  });
});

describe('sprinkle: Volley', () => {
  it('extends the fireworks by a layer for a perfect drop, at most twice per trigger', () => {
    const r = run(effect('sprinkle', 5, 5, 3));
    land(r);
    land(r, { quality: 'normal' });
    land(r);
    land(r);
    expect(r.state.effects[0]?.layersLeft).toBe(5 + MASTERY.sprinkle.maxExtend);
    expect(masteryEvents(r.events)).toHaveLength(2);
  });

  it('extends again after the sprinkle fires again', () => {
    const r = run({ ...effect('sprinkle', 5, 2, 3), uses: 2 });
    land(r);
    expect(r.state.effects[0]?.layersLeft).toBe(2);
    fire(r, 'sprinkle', 5);
    land(r);
    expect(r.state.effects[0]?.layersLeft).toBe(6);
  });
});

describe('crumb: Hoarder', () => {
  it('pays for a piece wider than 30% of the flying width, not for exactly 30%', () => {
    const r = run(effect('crumb', 5, 6, 10));
    land(r, { quality: 'normal', pieceWidth: 120, flyingWidth: 400 });
    expect(r.events).toEqual([]);
    land(r, { quality: 'normal', pieceWidth: 121, flyingWidth: 400 });
    expect(masteryCoins(r.events)).toBe(MASTERY.crumb.coins);
  });
});

describe('ghost: Not scary and the centre mark', () => {
  it('reports a cloud that the level-5 guides make see-through', () => {
    const r = run(effect('ghost', 5, 6));
    runCloudHooks(r.state, r.emit);
    expect(r.events).toEqual([{ type: 'mastery', creature: 'ghost', coins: 0, score: 0 }]);
    const low = run(effect('ghost', 4, 5));
    runCloudHooks(low.state, low.emit);
    expect(low.events).toEqual([]);
  });

  it('sets the flags by level', () => {
    expect(collectModifiers([effect('ghost', 1)])).toMatchObject({
      centreMark: false,
      guidesMaster: false,
    });
    expect(collectModifiers([effect('ghost', 2)])).toMatchObject({
      centreMark: true,
      guidesMaster: false,
    });
    expect(collectModifiers([effect('ghost', 5)])).toMatchObject({
      centreMark: true,
      guidesMaster: true,
    });
  });
});

describe('twins: Peace', () => {
  it('pays coins when level-5 twins land perfectly', () => {
    const perfect = run();
    fire(perfect, 'twins', 5, true);
    expect(masteryCoins(perfect.events)).toBe(MASTERY.twins.perfectCoins);
    const normal = run();
    fire(normal, 'twins', 5, false);
    expect(masteryEvents(normal.events)).toEqual([]);
  });
});

describe('lemon: Swagger', () => {
  /** Lands `qualities` one by one under a fresh level-5 lemon, counting down as the sim does. */
  function play(r: Run, qualities: Array<'perfect' | 'normal' | 'miss'>): void {
    for (const quality of qualities) {
      if (quality === 'miss') {
        runMissHooks(r.state, r.emit, null);
        continue;
      }
      land(r, { quality });
      tickRunEffects(r.state, r.emit);
    }
  }

  it('pays on the last of four perfect layers', () => {
    const r = run(effect('lemon', 5, 4, 5));
    play(r, ['perfect', 'perfect', 'perfect']);
    expect(masteryEvents(r.events)).toEqual([]);
    play(r, ['perfect']);
    expect(masteryCoins(r.events)).toBe(MASTERY.lemon.allPerfectCoins);
  });

  it('is spoiled by a normal drop or a miss, until the lemon fires again', () => {
    const normal = run(effect('lemon', 5, 4, 5));
    play(normal, ['perfect', 'normal', 'perfect', 'perfect']);
    const missed = run(effect('lemon', 5, 4, 5));
    play(missed, ['perfect', 'miss', 'perfect', 'perfect', 'perfect']);
    expect(masteryEvents([...normal.events, ...missed.events])).toEqual([]);

    const again = run({ ...effect('lemon', 5, 2, 5), spoiled: true });
    fire(again, 'lemon', 5);
    play(again, ['perfect', 'perfect', 'perfect', 'perfect']);
    expect(masteryCoins(again.events)).toBe(MASTERY.lemon.allPerfectCoins);
  });
});

describe('rainbow ladder', () => {
  it('pays flat score for every protected layer from level 2', () => {
    const one = run(effect('rainbow', 1, 2));
    land(one);
    expect(one.events).toEqual([]);
    const two = run(effect('rainbow', 2, 2), effect('sprinkle', 1, 5, 3));
    land(two);
    land(two, { quality: 'normal', pieceWidth: 80 });
    expect(two.state.score).toBe(100);
    expect(two.events).toEqual([
      { type: 'perk', creature: 'rainbow', perk: 'rainbow_protected_score', score: 50 },
      { type: 'perk', creature: 'rainbow', perk: 'rainbow_protected_score', score: 50 },
    ]);
  });

  it('protects its own layer from level 3', () => {
    const plan = (level: number) => ({
      kind: 'creature' as const,
      creature: 'rainbow' as const,
      level,
    });
    expect(dropModifiers([], plan(2)).protectCut).toBe(false);
    expect(dropModifiers([], plan(3)).protectCut).toBe(true);
    expect(dropModifiers([], { kind: 'plain' }).protectCut).toBe(false);
    expect(ABILITIES.honey.ownLayer).toBeUndefined();
  });

  it('After the rain: a perfect protected layer keeps the protection once per trigger', () => {
    const r = run(effect('rainbow', 5, 2));
    land(r);
    tickRunEffects(r.state, r.emit);
    expect(r.state.effects[0]?.layersLeft).toBe(2);
    land(r);
    tickRunEffects(r.state, r.emit);
    expect(r.state.effects[0]?.layersLeft).toBe(1);
    expect(masteryEvents(r.events)).toEqual([
      { type: 'mastery', creature: 'rainbow', coins: 0, score: 0 },
    ]);
  });

  it('does not return the protection for a normal drop', () => {
    const r = run(effect('rainbow', 5, 2));
    land(r, { quality: 'normal', pieceWidth: 60 });
    expect(r.state.effects[0]?.layersLeft).toBe(2);
    expect(masteryEvents(r.events)).toEqual([]);
  });
});
