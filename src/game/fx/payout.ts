import type { SimEvent } from '../../core/tower-sim';

/** What the events of one sim step pay out, as the screen needs it. */
export interface Payout {
  /** Coins of the floating coin that was caught. */
  floating: number;
  /** Coins of every other source (combo, perfect, crumb, golden, height bonus). */
  other: number;
  /** A golden layer landed perfectly: a berry is earned. */
  berry: boolean;
  /** The layer landed or missed: a floating coin that was not caught is gone. */
  resolved: boolean;
}

/** Sums up the coin events of one sim step. */
export function payoutFromEvents(events: readonly SimEvent[]): Payout {
  const pay: Payout = { floating: 0, other: 0, berry: false, resolved: false };
  for (const event of events) {
    switch (event.type) {
      case 'coin_collect':
        if (event.source === 'floating') pay.floating += event.amount;
        else pay.other += event.amount;
        break;
      case 'golden':
        if (event.perfect) pay.berry = true;
        break;
      case 'land':
      case 'miss':
        pay.resolved = true;
        break;
      default:
        break;
    }
  }
  return pay;
}
