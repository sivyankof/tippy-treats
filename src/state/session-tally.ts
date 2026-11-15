// Dev-only tally of what the player was paid in this page load, by source (debug panel).
// It lives in memory next to the save and never touches it.
import type { CoinSource } from '../core/sim-types';

/** Where a credit came from. Run coin sources are the ones of the run tally. */
export type CreditSource =
  | CoinSource
  | 'run_other'
  | 'run_berries'
  | 'run_xp'
  | 'ad_double'
  | 'mission'
  | 'chest'
  | 'streak'
  | 'gift'
  | 'gift_double'
  | 'daily_tier'
  | 'level_reward'
  | 'shop_free'
  | 'berry_exchange'
  | 'purchase'
  | 'debug';

export type TallyKind = 'coins' | 'berries' | 'xp';

/** The part of a save that a credit changes. */
export interface WalletView {
  coins: number;
  berries: number;
}

export type TallyTotals = Record<TallyKind, Partial<Record<CreditSource, number>>>;

/** Sources printed on one line of the panel. */
const SOURCES_PER_LINE = 3;

export class SessionTally {
  private totals: TallyTotals = { coins: {}, berries: {}, xp: {} };

  /** Adds `amount` to `source` of `kind`; anything but a positive number is ignored. */
  add(kind: TallyKind, source: CreditSource, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const bucket = this.totals[kind];
    bucket[source] = (bucket[source] ?? 0) + amount;
  }

  /** Adds what the wallet gained between two saves to `source`. */
  addWalletChange(source: CreditSource, before: WalletView, after: WalletView): void {
    this.add('coins', source, after.coins - before.coins);
    this.add('berries', source, after.berries - before.berries);
  }

  /** Sum over all sources of `kind`. */
  total(kind: TallyKind): number {
    return Object.values(this.totals[kind]).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  }

  /** A copy of the numbers, for tests. */
  snapshot(): TallyTotals {
    return {
      coins: { ...this.totals.coins },
      berries: { ...this.totals.berries },
      xp: { ...this.totals.xp },
    };
  }

  /** Text lines for the debug panel: a header per kind, then its sources, a few per line. */
  lines(): string[] {
    const out: string[] = [];
    for (const kind of ['coins', 'berries', 'xp'] as const) {
      const entries = Object.entries(this.totals[kind]);
      out.push(`session ${kind} ${this.total(kind)}`);
      for (let i = 0; i < entries.length; i += SOURCES_PER_LINE) {
        const line = entries
          .slice(i, i + SOURCES_PER_LINE)
          .map(([source, value]) => `${source} ${value}`)
          .join(', ');
        out.push(`  ${line}`);
      }
    }
    return out;
  }
}

/** The coins of a run split by source; what the sources do not explain (rounding) is `run_other`. */
export function runCoinCredits(
  runCoins: number,
  sources: Partial<Record<CoinSource, number>> | undefined,
): Array<[CreditSource, number]> {
  const credits: Array<[CreditSource, number]> = [];
  let explained = 0;
  for (const [source, amount] of Object.entries(sources ?? {})) {
    const whole = Math.max(0, Math.floor(amount));
    if (whole === 0) continue;
    credits.push([source as CoinSource, whole]);
    explained += whole;
  }
  const rest = runCoins - explained;
  if (rest > 0) credits.push(['run_other', rest]);
  return credits;
}
