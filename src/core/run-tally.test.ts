import { describe, expect, it } from 'vitest';
import { emptyTally, tallyEvents } from './run-tally';

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

  it('starts with no wobble', () => {
    expect(emptyTally().maxWobble).toBe(0);
  });
});
