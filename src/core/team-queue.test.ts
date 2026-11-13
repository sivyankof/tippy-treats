import { describe, expect, it } from 'vitest';
import type { TeamSlot } from './sim-types';
import { creatureSlotAt, isCreatureIndex, planLayer, type PlanState } from './team-queue';

const TEAM: TeamSlot[] = [
  { id: 'honey', level: 1 },
  { id: 'jelly', level: 2 },
  { id: 'caramel', level: 3 },
];

const START: PlanState = { lastIndex: 0, goldenPending: false };

/** Plans layers 1..last in order and returns the plans by index. */
function planAll(team: (TeamSlot | null)[], last: number, from: PlanState = START) {
  let state = from;
  const plans = new Map<number, ReturnType<typeof planLayer>['plan']>();
  for (let i = from.lastIndex + 1; i <= last; i++) {
    const planned = planLayer(i, team, state);
    state = planned.state;
    plans.set(i, planned.plan);
  }
  return plans;
}

describe('creatureSlotAt', () => {
  it('walks through the slots every sixth layer', () => {
    expect(creatureSlotAt(6, TEAM)?.id).toBe('honey');
    expect(creatureSlotAt(12, TEAM)?.id).toBe('jelly');
    expect(creatureSlotAt(18, TEAM)?.id).toBe('caramel');
    expect(creatureSlotAt(24, TEAM)?.id).toBe('honey');
    expect(creatureSlotAt(30, TEAM)?.id).toBe('jelly');
  });

  it('is empty for other layers, for layer 0 and for empty slots', () => {
    expect(creatureSlotAt(5, TEAM)).toBeNull();
    expect(creatureSlotAt(0, TEAM)).toBeNull();
    expect(creatureSlotAt(12, [TEAM[0] ?? null, null, null])).toBeNull();
    expect(creatureSlotAt(6, [])).toBeNull();
    expect(isCreatureIndex(6)).toBe(true);
    expect(isCreatureIndex(7)).toBe(false);
    expect(isCreatureIndex(0)).toBe(false);
  });
});

describe('planLayer', () => {
  it('makes layers 6, 12, 18 and 24 creatures with their level', () => {
    const plans = planAll(TEAM, 24);
    expect(plans.get(6)).toEqual({ kind: 'creature', creature: 'honey', level: 1 });
    expect(plans.get(12)).toEqual({ kind: 'creature', creature: 'jelly', level: 2 });
    expect(plans.get(18)).toEqual({ kind: 'creature', creature: 'caramel', level: 3 });
    expect(plans.get(24)).toEqual({ kind: 'creature', creature: 'honey', level: 1 });
    expect(plans.get(7)).toEqual({ kind: 'plain' });
  });

  it('keeps an empty slot plain without shifting the others', () => {
    const plans = planAll([TEAM[0] ?? null, null, TEAM[2] ?? null], 24);
    expect(plans.get(12)).toEqual({ kind: 'plain' });
    expect(plans.get(18)?.creature).toBe('caramel');
    expect(plans.get(24)?.creature).toBe('honey');
  });

  it('makes every 25th layer golden', () => {
    const plans = planAll(TEAM, 75);
    expect([...plans].filter(([, p]) => p.kind === 'golden').map(([i]) => i)).toEqual([25, 50, 75]);
  });

  it('moves a golden layer off a creature slot to the next plain layer', () => {
    // 150 = 25 * 6 is a creature index for the first slot.
    const withCreature = planAll(TEAM, 152, { lastIndex: 148, goldenPending: false });
    expect(withCreature.get(150)?.kind).toBe('creature');
    expect(withCreature.get(151)?.kind).toBe('golden');
    expect(withCreature.get(152)?.kind).toBe('plain');
    // With an empty slot there is no creature and the golden layer stays put.
    const empty = planAll([null, null, null], 151, { lastIndex: 148, goldenPending: false });
    expect(empty.get(150)?.kind).toBe('golden');
    expect(empty.get(151)?.kind).toBe('plain');
  });

  it('defers a golden layer that the height of twins skipped', () => {
    // Twins on layer 24 count as two: the next layer is 26, layer 25 was skipped.
    const afterTwins = planLayer(26, TEAM, { lastIndex: 24, goldenPending: false });
    expect(afterTwins.plan.kind).toBe('golden');
    expect(afterTwins.state.goldenPending).toBe(false);
    expect(planLayer(27, TEAM, afterTwins.state).plan.kind).toBe('plain');
  });

  it('keeps a deferred golden layer waiting through consecutive creature layers', () => {
    const team: TeamSlot[] = [TEAM[0] as TeamSlot, TEAM[1] as TeamSlot, TEAM[2] as TeamSlot];
    const first = planLayer(150, team, { lastIndex: 149, goldenPending: false });
    expect(first.state.goldenPending).toBe(true);
    expect(planLayer(151, team, first.state).plan.kind).toBe('golden');
  });
});
