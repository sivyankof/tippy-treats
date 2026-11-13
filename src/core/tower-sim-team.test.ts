import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import type { CreatureId } from '../data/creatures';
import { TimingBot } from './bot';
import { layerSpeed } from './drop';
import { Rng } from './rng';
import type { RunResult } from './run-result';
import {
  STEP,
  config,
  dropAt,
  mutable,
  only,
  pick,
  runUntil,
  untilFlying,
  untilSettled,
} from './sim-test-utils';
import { TowerSim, type RunConfig, type SimEvent } from './tower-sim';

const team = (...ids: Array<CreatureId | null>): RunConfig['team'] =>
  ids.map((id) => (id ? { id, level: 1 } : null));

/** Starts five layers below the first creature layer (index 6). */
const crew = (...ids: Array<CreatureId | null>): TowerSim =>
  new TowerSim(config({ startHeight: 5, team: team(...ids) }));

/** Waits for the next layer, removes its floating coin and drops it `offset` past the target. */
function drop(sim: TowerSim, offset = 0, coinX: number | null = null): SimEvent[] {
  const events = untilFlying(sim);
  mutable(sim).floatingCoinX = coinX;
  return [...events, ...dropAt(sim, offset)];
}

/** Waits for a layer and drops it far away from the tower: a complete miss. */
function missNow(sim: TowerSim, coinX: number | null = null): SimEvent[] {
  const events = untilFlying(sim);
  const state = mutable(sim);
  state.floatingCoinX = coinX;
  if (state.flying) state.flying.x = 2000;
  sim.drop();
  return [...events, ...untilSettled(sim)];
}

const land = (events: SimEvent[]) => only(events, 'land');
const abilityOf = (events: SimEvent[]) => only(events, 'ability');

describe('team queue in the run', () => {
  it('spawns creature layers at 6, 12, 18 and 24 and no others', () => {
    const sim = new TowerSim(config({ startHeight: 5, team: team('honey', 'jelly', 'caramel') }));
    const spawns: Array<[number, string, CreatureId | undefined]> = [];
    for (let i = 0; i < 20; i++) {
      for (const e of drop(sim)) {
        if (e.type === 'spawn') spawns.push([e.layer.index, e.layer.kind, e.layer.creature]);
      }
    }
    expect(spawns.filter(([, kind]) => kind === 'creature')).toEqual([
      [6, 'creature', 'honey'],
      [12, 'creature', 'jelly'],
      [18, 'creature', 'caramel'],
      [24, 'creature', 'honey'],
    ]);
    expect(spawns.find(([i]) => i === 25)?.[1]).toBe('golden');
    expect(spawns.find(([i]) => i === 7)?.[1]).toBe('plain');
  });

  it('carries the creature and its level to the flying and the placed layer', () => {
    const sim = new TowerSim(
      config({ startHeight: 5, team: [{ id: 'sprinkle', level: 4 }, null, null] }),
    );
    const spawn = only(untilFlying(sim), 'spawn').layer;
    expect(spawn).toMatchObject({ index: 6, kind: 'creature', creature: 'sprinkle', level: 4 });
    dropAt(sim, 0);
    expect(sim.state.layers.at(-1)).toMatchObject({
      kind: 'creature',
      creature: 'sprinkle',
      level: 4,
      quality: 'perfect',
    });
  });

  it('keeps an empty slot a plain layer', () => {
    const sim = new TowerSim(config({ startHeight: 11, team: team('honey', null, 'ghost') }));
    expect(only(untilFlying(sim), 'spawn').layer).toMatchObject({ index: 12, kind: 'plain' });
  });

  it('keeps the creature after a continue and runs its ability once on the retry', () => {
    const sim = new TowerSim(config({ startHeight: 5, mode: 'classic', team: team('honey') }));
    missNow(sim);
    const retry = sim.continueRun();
    expect(only(retry, 'spawn').layer).toMatchObject({
      index: 6,
      kind: 'creature',
      creature: 'honey',
    });
    expect(pick(dropAt(sim, 0), 'ability')).toHaveLength(1);
  });

  it('does not run an ability for plain layers, and a miss on a creature layer runs none', () => {
    const sim = crew('honey');
    const events = missNow(sim);
    expect(pick(events, 'ability')).toHaveLength(0);
    expect(sim.state.effects).toEqual([]);
  });
});

describe('effect timing', () => {
  it('counts the layers after the creature and then reports the end', () => {
    const sim = crew('honey');
    const first = drop(sim, 100);
    expect(abilityOf(first)).toMatchObject({ creature: 'honey', boosted: false });
    expect(sim.state.effects).toEqual([
      { id: 'honey', layersLeft: 3, level: 1, boosted: false, value: 30 },
    ]);
    expect(pick(first, 'effect_end')).toHaveLength(0);

    for (const expected of [2, 1]) {
      drop(sim);
      expect(sim.state.effects[0]?.layersLeft).toBe(expected);
    }
    const last = drop(sim);
    expect(only(last, 'effect_end')).toEqual({ type: 'effect_end', effect: 'honey' });
    expect(sim.state.effects).toEqual([]);
  });

  it('lasts longer after a perfect creature layer', () => {
    const sim = crew('honey');
    drop(sim, 0);
    expect(sim.state.effects[0]).toMatchObject({ layersLeft: 5, boosted: true });
  });

  it('does not tick on a shielded miss', () => {
    const sim = crew('sprinkle', null, null);
    drop(sim, 100);
    mutable(sim).shield = 2;
    const before = sim.state.effects[0]?.layersLeft;
    only(missNow(sim), 'miss');
    expect(sim.state.effects[0]?.layersLeft).toBe(before);
  });

  it('applies the effect to the speed of the layer spawned after the creature', () => {
    const sim = crew('frosty');
    drop(sim, 100);
    const next = only(untilFlying(sim), 'spawn').layer;
    expect(next.speed).toBeCloseTo(layerSpeed(6, 0.8));
    expect(sim.currentModifiers().speedMult).toBeCloseTo(0.8);
    const lemon = crew('lemon');
    drop(lemon, 100);
    expect(only(untilFlying(lemon), 'spawn').layer.speed).toBeCloseTo(layerSpeed(6, 1.2));
  });
});

describe('abilities in play', () => {
  it('honey makes a slightly off drop perfect', () => {
    const plain = new TowerSim(config({ startHeight: 5 }));
    expect(land(drop(plain, 22)).quality).toBe('normal');

    const sim = crew('honey');
    drop(sim, 100);
    // The sway from the creature layer would shift the target, so each drop starts calm.
    const calmDrop = (offset: number): SimEvent[] => {
      untilFlying(sim);
      mutable(sim).wobble = 0;
      return drop(sim, offset);
    };
    expect(land(calmDrop(22)).quality).toBe('perfect');
    expect(land(calmDrop(28)).quality).toBe('perfect');
    expect(land(calmDrop(33)).quality).toBe('normal');
  });

  it('puff widens the layer before the next one spawns', () => {
    const sim = crew('puff');
    const events = drop(sim, 100);
    const landed = land(events);
    expect(abilityOf(events).payload).toEqual({ widened: 45 });
    expect(sim.state.layers.at(-1)?.width).toBeCloseTo(landed.newWidth + 45);
    expect(only(untilFlying(sim), 'spawn').layer.width).toBeCloseTo(landed.newWidth + 45);
  });

  it('jelly calms the tower before the sneeze check', () => {
    const sim = crew('jelly');
    untilFlying(sim);
    mutable(sim).wobble = 99;
    const events = drop(sim, 150);
    expect(pick(events, 'wobble_sneeze')).toHaveLength(0);
    expect(sim.state.wobble).toBeGreaterThan(50);
    expect(sim.state.wobble).toBeLessThan(61);
  });

  it('jelly springs the next normal drops to the centre: smaller cut, less wobble', () => {
    const jelly = crew('jelly');
    const control = crew(null);
    for (const sim of [jelly, control]) drop(sim, 150);
    const spring = land(drop(jelly, 100));
    const plain = land(drop(control, 100));
    // Level 1 springs 30% of the offset back, so about 70% of it is cut.
    expect(spring.cutWidth).toBeGreaterThan(plain.cutWidth * 0.6);
    expect(spring.cutWidth).toBeLessThan(plain.cutWidth * 0.8);
    expect(spring.newWidth).toBeGreaterThan(plain.newWidth);
    expect(Math.abs(spring.dx)).toBeCloseTo(plain.cutWidth * 0.7, -1);
    expect(jelly.state.wobble).toBeLessThan(control.state.wobble);
  });

  it.each([
    ['a normal landing', 150, 4],
    ['a perfect landing', 0, 6],
  ])('jelly spring lasts exactly its layers after %s', (_name, offset, layers) => {
    const sim = crew('jelly');
    drop(sim, offset);
    const left = () => sim.state.effects.find((e) => e.id === 'jelly')?.layersLeft;
    expect(left()).toBe(layers);
    for (let i = 1; i < layers; i++) {
      drop(sim, 30);
      expect(left()).toBe(layers - i);
    }
    drop(sim, 30);
    expect(left()).toBeUndefined();
  });

  it('puff cannot save a sneeze, but the sneeze happens after it', () => {
    const sim = crew('puff');
    untilFlying(sim);
    mutable(sim).wobble = 99;
    const events = drop(sim, 100);
    const sneeze = only(events, 'wobble_sneeze');
    expect(sneeze.newWidth).toBeCloseTo((land(events).newWidth + 45) * 0.85);
  });

  it('sprinkle multiplies the score of the following layers', () => {
    const sim = crew('sprinkle');
    drop(sim, 100);
    const before = sim.state.score;
    drop(sim, 100);
    expect(sim.state.score - before).toBe(20);
  });

  it('lemon multiplies the score and pays a coin for each perfect drop, unmultiplied', () => {
    const sim = crew('lemon');
    drop(sim, 100);
    const score = sim.state.score;
    const coins = sim.state.coins;
    const events = drop(sim, 0);
    expect(sim.state.score - score).toBe(Math.round((25 + 5) * 3));
    expect(sim.state.coins - coins).toBe(1);
    expect(only(events, 'coin_collect')).toEqual({ type: 'coin_collect', amount: 1 });
  });

  it('rainbow makes drops perfect, but not a complete miss', () => {
    const sim = crew('rainbow');
    drop(sim, 100);
    const wide = drop(sim, 150);
    expect(land(wide).quality).toBe('perfect');
    expect(only(wide, 'combo').value).toBe(1);
    expect(sim.state.layers.at(-1)?.x).toBe(sim.state.layers.at(-2)?.x);

    only(missNow(sim), 'miss');
    expect(sim.state.phase).toBe('await_continue');
  });

  it('ghost only shows guides: the modifiers carry the flag', () => {
    const sim = crew('ghost');
    drop(sim, 100);
    expect(sim.currentModifiers().guides).toBe(true);
    expect(sim.currentModifiers().perfectTolerance).toBe(BALANCE.drop.perfectTolerance);
  });
});

describe('twins and height', () => {
  it('counts the creature as two layers and starts the next layer above', () => {
    const sim = crew('twins');
    const events = drop(sim, 100);
    expect(sim.state).toMatchObject({ height: 7, bonusHeight: 1, score: 10 + 50 });
    expect(sim.state.layers).toHaveLength(6);
    expect(abilityOf(events).payload).toEqual({ bonusScore: 50, bonusHeight: 1 });
    expect(only(untilFlying(sim), 'spawn').layer.index).toBe(8);
  });

  it('boosts the bonus score on a perfect drop but not the height', () => {
    const sim = crew('twins');
    drop(sim, 0);
    expect(sim.state).toMatchObject({ height: 7, bonusHeight: 1, score: 30 + 75 });
  });

  it('shifts the layer numbers and the creature rhythm by the bonus height', () => {
    const sim = crew('twins', 'honey');
    drop(sim, 0);
    const kinds: Array<[number, string]> = [];
    for (let i = 0; i < 6; i++) {
      for (const e of drop(sim)) if (e.type === 'spawn') kinds.push([e.layer.index, e.layer.kind]);
    }
    // 8..12: layer 12 is the second creature slot.
    expect(kinds.find(([i]) => i === 12)?.[1]).toBe('creature');
  });

  it('puts the run result height at layers plus the bonus', () => {
    const sim = new TowerSim(config({ mode: 'daily', startHeight: 5, team: team('twins') }));
    drop(sim, 0);
    const result = only(missNow(sim), 'run_over').result;
    expect(result.height).toBe(7);
  });
});

describe('brownie shield', () => {
  const shielded = (): TowerSim => {
    const sim = crew('brownie', null, null);
    drop(sim, 100);
    return sim;
  };
  const missNext = missNow;

  /**
   * Waits for a layer, makes it narrow and drops it 22 off-centre with the wobble loaded: a sneeze
   * miss. The sway is timed to cross zero at the landing, so the offset is not shifted by it.
   */
  const sneezeDrop = (sim: TowerSim): SimEvent[] => {
    untilFlying(sim);
    const state = mutable(sim);
    if (state.flying) {
      state.flying.width = 50;
      state.flying.speed = 120;
    }
    state.wobble = 0;
    const events = untilFlying(sim);
    const passed = (): boolean => {
      const flying = sim.state.flying;
      return !!flying && (flying.x - sim.topLayerX()) * flying.dir >= 22;
    };
    events.push(...runUntil(sim, () => !passed()), ...runUntil(sim, passed));
    sim.drop();
    state.wobble = 99;
    const fallSteps = Math.ceil(BALANCE.layer.fallMs / STEP);
    state.wobblePhase = -((fallSteps * 2 * Math.PI * STEP) / BALANCE.wobble.periodMs);
    return [...events, ...untilSettled(sim)];
  };

  it('starts with the creature layer and ticks down with every landed layer', () => {
    const sim = shielded();
    expect(sim.state.shield).toBe(5);
    drop(sim);
    expect(sim.state.shield).toBe(4);
  });

  it('eats a drop miss: the run goes on and the same layer comes back', () => {
    const sim = shielded();
    drop(sim, 100);
    drop(sim, 100);
    const flyingBefore = only(untilFlying(sim), 'spawn').layer;
    const width = flyingBefore.width;
    const height = sim.state.height;
    mutable(sim).combo = 3;
    mutable(sim).flying!.x = 2000;
    sim.drop();
    let events: SimEvent[] = [];
    while (sim.state.phase !== 'pause') events = events.concat(sim.update(STEP));
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: true });
    expect(pick(events, 'run_over')).toHaveLength(0);
    expect(sim.state).toMatchObject({ shield: 0, combo: 0, height });

    const again = untilFlying(sim);
    const spawn = only(again, 'spawn').layer;
    expect(spawn).toMatchObject({ index: flyingBefore.index, width, kind: flyingBefore.kind });
    expect(pick(again, 'coin_spawn')).toHaveLength(0);
    expect(sim.state.floatingCoinX).toBeNull();
  });

  it('keeps the creature on a retried creature layer', () => {
    const sim = new TowerSim(config({ startHeight: 11, team: team(null, 'jelly', 'brownie') }));
    mutable(sim).shield = 3;
    untilFlying(sim);
    mutable(sim).flying!.x = 2000;
    sim.drop();
    const events = untilFlying(sim);
    expect(only(events, 'spawn').layer).toMatchObject({
      index: 12,
      kind: 'creature',
      creature: 'jelly',
    });
  });

  it('is gone after the miss: the next miss is a normal one', () => {
    const sim = shielded();
    missNext(sim);
    const events = missNext(sim);
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: false });
    expect(sim.state.phase).toBe('await_continue');
  });

  it('still saves a drop miss on the last layer it covers', () => {
    const sim = shielded();
    for (let i = 0; i < 4; i++) drop(sim, 30);
    expect(sim.state.shield).toBe(1);
    expect(only(missNext(sim), 'miss').shielded).toBe(true);
  });

  it('expires after its layers and says so', () => {
    const sim = shielded();
    let ended: SimEvent[] = [];
    for (let i = 0; i < 5; i++) ended = ended.concat(drop(sim, 30));
    expect(sim.state.shield).toBe(0);
    expect(pick(ended, 'effect_end')).toEqual([{ type: 'effect_end', effect: 'shield' }]);
    expect(only(missNext(sim), 'miss').shielded).toBe(false);
  });

  it('also saves a sneeze miss: the narrow layer stays and the next one is restored', () => {
    const sim = new TowerSim(config({ mode: 'daily' }));
    mutable(sim).shield = 3;
    const events = sneezeDrop(sim);
    expect(only(events, 'wobble_sneeze').newWidth).toBeLessThan(BALANCE.drop.missMargin);
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: true });
    expect(pick(events, 'run_over')).toHaveLength(0);
    expect(sim.state).toMatchObject({ phase: 'pause', shield: 0, combo: 0, height: 1 });
    expect(sim.state.layers).toHaveLength(1);
    expect(sim.state.layers[0]?.width).toBeLessThan(BALANCE.drop.missMargin);

    const next = only(untilFlying(sim), 'spawn').layer;
    expect(next).toMatchObject({ index: 2, width: 250 });
    expect(BALANCE.team.shieldRestoreWidth).toBe(250);
  });

  /** Drops the creature layer at offset 100 and then `n` more normal layers. */
  const shieldedAfter = (n: number): TowerSim => {
    const sim = shielded();
    for (let i = 0; i < n; i++) drop(sim, 30);
    return sim;
  };

  it('brings a narrow layer back 250 wide after a drop miss', () => {
    const sim = shielded();
    untilFlying(sim);
    const state = mutable(sim);
    if (state.flying) {
      state.flying.width = 100;
      state.flying.x = 2000;
    }
    sim.drop();
    untilSettled(sim);
    expect(sim.state.phase).toBe('pause');
    expect(only(untilFlying(sim), 'spawn').layer.width).toBe(250);
  });

  it('keeps a wide layer as it was after a drop miss', () => {
    const sim = shielded();
    untilFlying(sim);
    const state = mutable(sim);
    if (state.flying) {
      state.flying.width = 400;
      state.flying.x = 2000;
    }
    sim.drop();
    untilSettled(sim);
    expect(only(untilFlying(sim), 'spawn').layer.width).toBe(400);
  });

  it('protects the layer N (the last one) against a sneeze, the next layer 250 wide', () => {
    const sim = shieldedAfter(4);
    expect(sim.state.shield).toBe(1);
    const events = sneezeDrop(sim);
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: true });
    expect(sim.state.phase).toBe('pause');
    expect(only(untilFlying(sim), 'spawn').layer.width).toBe(250);
  });

  it('protects the first layer after the brownie against a sneeze', () => {
    const sim = shielded();
    expect(only(sneezeDrop(sim), 'miss').shielded).toBe(true);
  });

  it('does not protect the brownie layer itself against its own sneeze', () => {
    const sim = crew('brownie', null, null);
    const events = sneezeDrop(sim);
    expect(pick(events, 'ability')).toHaveLength(1);
    expect(only(events, 'miss')).toEqual({ type: 'miss', shielded: false });
    expect(sim.state.phase).toBe('await_continue');
  });

  it('does not protect layer N+1 against a drop miss or a sneeze', () => {
    const dropMiss = shieldedAfter(5);
    expect(dropMiss.state.shield).toBe(0);
    expect(only(missNow(dropMiss), 'miss').shielded).toBe(false);

    const sneeze = shieldedAfter(5);
    expect(only(sneezeDrop(sneeze), 'miss').shielded).toBe(false);
  });

  it('restores 360 on a continue, not the shield width', () => {
    const sim = new TowerSim(config({ startHeight: 5, mode: 'classic' }));
    untilFlying(sim);
    const state = mutable(sim);
    if (state.flying) {
      state.flying.width = 100;
      state.flying.x = 2000;
    }
    sim.drop();
    untilSettled(sim);
    expect(only(sim.continueRun(), 'spawn').layer.width).toBe(BALANCE.continues.restoreWidth);
    expect(BALANCE.continues.restoreWidth).toBe(360);
  });

  it('does not open the continue offer', () => {
    const sim = shielded();
    missNext(sim);
    expect(sim.state.phase).not.toBe('await_continue');
    expect(sim.state.continuesUsed).toBe(0);
  });
});

describe('coins', () => {
  it('spawns floating coins from layer 5 with the allowed offset and deterministically', () => {
    const xs: number[] = [];
    const run = (): number => {
      const sim = new TowerSim(config({ seed: 9 }));
      let spawns = 0;
      for (let i = 0; i < 60; i++) {
        const events = untilFlying(sim);
        for (const e of pick(events, 'coin_spawn')) {
          spawns++;
          xs.push(e.x);
          expect(sim.state.flying?.index).toBeGreaterThanOrEqual(BALANCE.coins.fromLayer);
        }
        dropAt(sim, 0);
      }
      return spawns;
    };
    const spawns = run();
    expect(spawns).toBeGreaterThan(8);
    expect(spawns).toBeLessThan(35);
    for (const x of xs) expect(Math.abs(x - BALANCE.tray.centerX)).toBeLessThanOrEqual(260);
    expect(run()).toBe(spawns);
  });

  it('collects a coin the landed layer covers, after the cut', () => {
    const sim = new TowerSim(config({ startHeight: 5 }));
    // Layer 6 comes from the right: a 100 px cut on the left leaves 620 px centred on 490, covering 180..800.
    const events = drop(sim, 100, 790);
    expect(only(events, 'coin_collect')).toEqual({ type: 'coin_collect', amount: 1 });
    expect(sim.state.coins).toBe(1);
    expect(sim.state.floatingCoinX).toBeNull();
  });

  it('loses a coin the cut layer no longer covers', () => {
    const sim = new TowerSim(config({ startHeight: 5 }));
    const events = drop(sim, 100, 810);
    expect(pick(events, 'coin_collect')).toHaveLength(0);
    expect(sim.state.coins).toBe(0);
    expect(sim.state.floatingCoinX).toBeNull();
  });

  it('loses the coin on a miss and does not roll a new one for the retry', () => {
    const sim = new TowerSim(config({ startHeight: 5, mode: 'classic' }));
    only(missNow(sim, 540), 'miss');
    expect(sim.state.floatingCoinX).toBeNull();
    const retry = sim.continueRun();
    expect(pick(retry, 'coin_spawn')).toHaveLength(0);
    expect(only(retry, 'spawn').layer.index).toBe(6);
    expect(sim.state.floatingCoinX).toBeNull();
  });

  it('doubles floating coins and combo coins with caramel', () => {
    const sim = crew('caramel');
    drop(sim, 100);
    expect(only(drop(sim, 0, 540), 'coin_collect').amount).toBe(2);
    let combo: SimEvent[] = [];
    for (let i = 0; i < 4; i++) combo = drop(sim, 0);
    expect(sim.state.combo).toBe(5);
    expect(only(combo, 'coin_collect').amount).toBe(2);
  });

  it('pays one coin for every perfect drop from the fifth combo on', () => {
    const sim = new TowerSim(config({ startHeight: 5 }));
    const amounts: number[] = [];
    for (let i = 0; i < 6; i++) {
      amounts.push(pick(drop(sim, 0), 'coin_collect').reduce((sum, e) => sum + e.amount, 0));
    }
    expect(amounts).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it('turns the cut edge into coins with crumb, never multiplied by caramel', () => {
    const sim = crew('crumb');
    drop(sim, 100);
    const events = drop(sim, 100);
    const cut = land(events).cutWidth;
    expect(only(events, 'coin_collect').amount).toBe(Math.floor(cut / 24));

    const both = new TowerSim(config({ startHeight: 5, team: team('crumb', null, null) }));
    mutable(both).effects.push({
      id: 'caramel',
      layersLeft: 9,
      level: 1,
      boosted: false,
      value: 1,
    });
    drop(both, 100);
    const next = drop(both, 100);
    expect(only(next, 'coin_collect').amount).toBe(Math.floor(land(next).cutWidth / 24));
  });

  it('adds a height bonus of 2 coins per 10 layers when the run ends', () => {
    const sim = new TowerSim(config({ mode: 'daily', startHeight: 24 }));
    const events = missNow(sim);
    expect(only(events, 'coin_collect')).toEqual({ type: 'coin_collect', amount: 4 });
    const result = only(events, 'run_over').result;
    expect(result.coins).toBe(4);
    expect(sim.state.coins).toBe(4);
  });
});

describe('golden layers', () => {
  const goldenSim = (startHeight = 24, teamSetup: RunConfig['team'] = [null, null, null]) =>
    new TowerSim(config({ startHeight, team: teamSetup }));

  it('pays a berry and 100 score for a perfect golden layer', () => {
    const sim = goldenSim();
    expect(only(untilFlying(sim), 'spawn').layer).toMatchObject({ index: 25, kind: 'golden' });
    const events = drop(sim, 0);
    expect(only(events, 'golden')).toEqual({ type: 'golden', perfect: true });
    expect(sim.state).toMatchObject({ berries: 1, score: 30 + 100, coins: 0 });
    expect(sim.state.layers.at(-1)?.kind).toBe('golden');
  });

  it('pays 10 coins for a normal golden layer', () => {
    const sim = goldenSim();
    const events = drop(sim, 100);
    expect(only(events, 'golden')).toEqual({ type: 'golden', perfect: false });
    expect(only(events, 'coin_collect').amount).toBe(10);
    expect(sim.state).toMatchObject({ berries: 0, score: 10, coins: 10 });
  });

  it('does not multiply the golden coins or the golden score', () => {
    const sim = goldenSim();
    mutable(sim).effects.push(
      { id: 'caramel', layersLeft: 5, level: 1, boosted: false, value: 1 },
      { id: 'sprinkle', layersLeft: 5, level: 1, boosted: false, value: 2 },
    );
    drop(sim, 100);
    expect(sim.state.coins).toBe(10);
    expect(sim.state.score).toBe(20);
  });

  it('moves to the next layer when layer 25 would be a creature slot', () => {
    // Layer 150 is a creature index; the golden layer is 151.
    const sim = goldenSim(149, team('honey'));
    expect(only(untilFlying(sim), 'spawn').layer).toMatchObject({ index: 150, kind: 'creature' });
    dropAt(sim, 0);
    expect(only(untilFlying(sim), 'spawn').layer).toMatchObject({ index: 151, kind: 'golden' });
  });

  it('moves to the next layer when twins skip layer 25', () => {
    const sim = goldenSim(23, team('twins'));
    expect(only(untilFlying(sim), 'spawn').layer).toMatchObject({ index: 24, kind: 'creature' });
    dropAt(sim, 0);
    expect(sim.state.height).toBe(25);
    expect(only(untilFlying(sim), 'spawn').layer).toMatchObject({ index: 26, kind: 'golden' });
  });
});

describe('determinism with a team', () => {
  function bot(seed: number): RunResult {
    const sim = new TowerSim(
      config({ seed, team: team('honey', 'rainbow', 'brownie') as RunConfig['team'] }),
    );
    const player = new TimingBot(45, new Rng(seed + 1));
    for (let i = 0; i < 400_000; i += 1) {
      const events = sim.update(STEP);
      if (sim.state.phase === 'await_continue') events.push(...sim.decline());
      player.observe(events);
      const over = pick(events, 'run_over')[0];
      if (over) return over.result;
      if (player.shouldDrop(sim)) sim.drop();
    }
    throw new Error('run did not end');
  }

  it('gives the same result for the same seed and bot', () => {
    const first = bot(31);
    expect(first.height).toBeGreaterThan(5);
    expect(bot(31)).toEqual(first);
  });

  it('differs between seeds', () => {
    expect(bot(31)).not.toEqual(bot(32));
  });
});
