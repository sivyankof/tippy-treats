import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../core/tower-sim';
import { payoutFromEvents } from './payout';

const land: SimEvent = {
  type: 'land',
  quality: 'perfect',
  dx: 0,
  cutWidth: 0,
  cutSide: null,
  newWidth: 100,
};

describe('payoutFromEvents', () => {
  it('is empty for a step without coin events and unresolved without a landing', () => {
    expect(payoutFromEvents([{ type: 'effect_end', effect: 'x' }])).toEqual({
      floating: 0,
      other: 0,
      berry: false,
      resolved: false,
    });
  });

  it('keeps the floating coin apart from every other source', () => {
    const pay = payoutFromEvents([
      land,
      { type: 'coin_collect', amount: 1, source: 'floating' },
      { type: 'coin_collect', amount: 2, source: 'combo' },
      { type: 'coin_collect', amount: 1, source: 'perfect' },
      { type: 'coin_collect', amount: 10, source: 'golden' },
    ]);
    expect(pay.floating).toBe(1);
    expect(pay.other).toBe(13);
    expect(pay.resolved).toBe(true);
  });

  it('sees a berry only for a perfect golden layer', () => {
    expect(payoutFromEvents([{ type: 'golden', perfect: true }]).berry).toBe(true);
    expect(payoutFromEvents([{ type: 'golden', perfect: false }]).berry).toBe(false);
  });

  it('counts a miss as the end of the floating coin too', () => {
    expect(payoutFromEvents([{ type: 'miss', shielded: false }]).resolved).toBe(true);
  });

  it('pays the height bonus at the end of a run as another source', () => {
    const pay = payoutFromEvents([{ type: 'coin_collect', amount: 6, source: 'height' }]);
    expect(pay.other).toBe(6);
    expect(pay.floating).toBe(0);
  });
});
