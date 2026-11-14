import type { FlyingLayer, SimEvent, TowerState } from '../src/core/sim-types';
import { ZONES } from '../src/data/zones';
import type { RunObserver } from './run-observer';

export type EndRow = Record<string, string | number>;

/** What the layer that ended a run was doing; the columns of the miss table, in order. */
const MISS_KINDS = [
  'kitchen',
  'showcase side',
  'rush',
  'roof',
  'cloud at tap',
  'clouds clear',
  'fake-out',
  'stars no fake-out',
  'sneeze',
] as const;
type MissKind = (typeof MISS_KINDS)[number];

const percentOf = (count: number, total: number): number =>
  Number(((100 * count) / Math.max(1, total)).toFixed(1));

/**
 * Where runs end: the zone of the last layer and the rule that was acting on the layer the
 * run was lost on. Space layers are counted by the rule they drew. A sneeze end (the layer
 * landed but the sneeze left too little of it) is its own column.
 */
export class EndStats implements RunObserver {
  private readonly zoneEnds = ZONES.map(() => 0);
  private readonly missKinds = new Map<MissKind, number>(MISS_KINDS.map((kind) => [kind, 0]));
  private runs = 0;
  /** The layer in the air before the step, and what happened to it so far. */
  private flying: FlyingLayer | null = null;
  private fakedOut = false;
  private coveredAtTap = false;

  beforeStep(state: Readonly<TowerState>): void {
    const flying = state.flying;
    if (flying && flying.index !== this.flying?.index) {
      this.fakedOut = false;
      this.coveredAtTap = false;
    }
    if (flying) this.flying = { ...flying };
  }

  noteDrop(state: Readonly<TowerState>): void {
    this.coveredAtTap = (state.flying?.coverMs ?? 0) > 0;
  }

  noteEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'fakeout') this.fakedOut = true;
      if (event.type !== 'run_over') continue;
      this.runs += 1;
      const zone = Math.min(this.zoneEnds.length - 1, event.result.zoneIndex);
      this.zoneEnds[zone] = (this.zoneEnds[zone] ?? 0) + 1;
      const kind = event.result.endReason === 'sneeze' ? 'sneeze' : this.missKind();
      this.missKinds.set(kind, (this.missKinds.get(kind) ?? 0) + 1);
      this.flying = null;
    }
  }

  private missKind(): MissKind {
    const layer = this.flying;
    if (!layer) return 'kitchen';
    switch (layer.rule) {
      case 'showcase':
        return layer.rush ? 'rush' : 'showcase side';
      case 'roof':
        return 'roof';
      case 'clouds':
        return this.coveredAtTap ? 'cloud at tap' : 'clouds clear';
      case 'stars':
        return this.fakedOut ? 'fake-out' : 'stars no fake-out';
      default:
        return 'kitchen';
    }
  }

  /** Share of runs (percent) that ended in each zone. */
  zoneRow(profile: string): EndRow {
    const row: EndRow = { profile };
    ZONES.forEach((zone, i) => {
      row[zone.id] = percentOf(this.zoneEnds[i] ?? 0, this.runs);
    });
    return row;
  }

  /** Share of runs (percent) by the rule on the layer that ended them. */
  missRow(profile: string): EndRow {
    const row: EndRow = { profile };
    for (const kind of MISS_KINDS) row[kind] = percentOf(this.missKinds.get(kind) ?? 0, this.runs);
    return row;
  }
}
