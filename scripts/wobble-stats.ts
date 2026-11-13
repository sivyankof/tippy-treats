import type { SimEvent, TowerState } from '../src/core/sim-types';
import { wobbleAmplitude } from '../src/core/wobble';
import { BALANCE } from '../src/data/balance';

/** Wobble levels the report counts drops above. */
const HIGH_WOBBLE = 40;
const SEVERE_WOBBLE = 70;

export type WobbleRow = Record<string, string | number>;

const round1 = (value: number): number => Number(value.toFixed(1));
const percentOf = (count: number, total: number): number =>
  round1((100 * count) / Math.max(1, total));

/**
 * Collects the wobble at the moment of every tap and the sneezes of a set of runs.
 * The first layer of a run lands on the tray, which never sways, so it is skipped.
 */
export class WobbleStats {
  private readonly wobbles: number[] = [];
  private readonly sways: number[] = [];
  private sneezes = 0;
  private runs = 0;

  /** Call right before the bot taps. */
  noteDrop(state: Readonly<TowerState>): void {
    if (state.layers.length === 0) return;
    this.wobbles.push(state.wobble);
    this.sways.push(wobbleAmplitude(state.wobble));
  }

  noteEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'wobble_sneeze') this.sneezes += 1;
      if (event.type === 'run_over') this.runs += 1;
    }
  }

  row(profile: string): WobbleRow {
    const total = this.wobbles.length;
    const sorted = [...this.wobbles].sort((a, b) => a - b);
    const sum = (values: number[]): number => values.reduce((acc, v) => acc + v, 0);
    const tolerance = BALANCE.drop.perfectTolerance;
    return {
      profile,
      'wobble mean': round1(sum(this.wobbles) / Math.max(1, total)),
      'wobble median': round1(sorted[Math.floor(total / 2)] ?? 0),
      [`> ${HIGH_WOBBLE}, %`]: percentOf(this.wobbles.filter((w) => w > HIGH_WOBBLE).length, total),
      [`> ${SEVERE_WOBBLE}, %`]: percentOf(
        this.wobbles.filter((w) => w > SEVERE_WOBBLE).length,
        total,
      ),
      'sway mean, px': round1(sum(this.sways) / Math.max(1, total)),
      [`sway > ${tolerance} px, %`]: percentOf(
        this.sways.filter((a) => a > tolerance).length,
        total,
      ),
      'sneezes per run': Number((this.sneezes / Math.max(1, this.runs)).toFixed(2)),
    };
  }
}
