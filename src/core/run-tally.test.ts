import { describe, expect, it } from 'vitest';
import { abilityCounts, emptyTally, tallyEvents } from './run-tally';

describe('run tally', () => {
  it('sums coins by source and counts abilities', () => {
    const tally = emptyTally();
    tallyEvents(tally, [
      { type: 'coin_collect', amount: 2, source: 'floating' },
      { type: 'coin_collect', amount: 3, source: 'floating' },
      { type: 'coin_collect', amount: 10, source: 'height' },
      { type: 'ability', creature: 'puff', boosted: false, payload: { kind: 'puff', widened: 10 } },
    ] as never);
    expect(tally.coins.floating).toBe(5);
    expect(tally.coins.height).toBe(10);
    expect(tally.abilities).toBe(1);
  });

  it('counts abilities per creature, most triggers first', () => {
    const tally = emptyTally();
    const fire = (creature: string): unknown => ({
      type: 'ability',
      creature,
      boosted: false,
      payload: {},
    });
    tallyEvents(tally, [fire('puff'), fire('honey'), fire('puff')] as never);
    expect(tally.abilityByCreature).toEqual({ puff: 2, honey: 1 });
    expect(abilityCounts(tally)).toEqual([
      { id: 'puff', count: 2 },
      { id: 'honey', count: 1 },
    ]);
    expect(abilityCounts(emptyTally())).toEqual([]);
  });

  it('starts with no wobble', () => {
    expect(emptyTally().maxWobble).toBe(0);
  });
});
