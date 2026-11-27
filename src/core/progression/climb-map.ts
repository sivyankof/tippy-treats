import { BALANCE } from '../../data/tower/balance';
import { SPACE_ZONE_INDEX, ZONES, type ZoneId } from '../../data/zones/zones';
import { lapFirstIndex, spaceLap } from '../zones/space-laps';

/** What the climb map shows of the save (docs/04-meta-retention.md, section 12). */
export interface ClimbMapInput {
  /** Best Classic height; `null` before the first run ends. */
  record: number | null;
  /** Best Classic height of today; 0 when there was no run today. */
  todayBest: number;
  /** Opened checkpoint heights. */
  checkpoints: readonly number[];
  /** Highest Space lap ever reached. */
  bestLap: number;
}

/** One stripe of the ribbon: a Classic zone or a lap of Space, `from`..`to` are 1-based layer indexes. */
export interface ClimbBand {
  kind: 'zone' | 'lap';
  zone: ZoneId;
  /** Lap of Space (1 for the zone itself); 0 for a Classic zone. */
  lap: number;
  from: number;
  to: number;
  /** The record reached its first layer (the kitchen is always open): shown with its name, not as a silhouette. */
  open: boolean;
}

export type ClimbMarkKind = 'record' | 'today' | 'checkpoint' | 'bestLap';

export interface ClimbMark {
  kind: ClimbMarkKind;
  /** Height in layers: the mark stands on top of this layer. For the best lap, the first layer of the lap. */
  height: number;
  /** Index (bottom-up) of the band the mark stands in. */
  band: number;
  /** The number shown: the height, or the lap for `bestLap`. */
  value: number;
}

export interface ClimbMap {
  bands: ClimbBand[];
  marks: ClimbMark[];
  /** The next band the record has not reached, and how many layers are left to its first layer. */
  goal: { band: number; layers: number };
  /** The height the ribbon scrolls to (the record; 0 for a newcomer). */
  anchor: number;
  /** Layers from the bottom to the top of the last band. */
  totalLayers: number;
}

/** First lap from which the best lap is marked: lap 1 is just Space itself. */
const BEST_LAP_FROM = 2;

/** Index of the band a layer stands in (every height the map gets lies below the top of the last band). */
function bandIndexOf(bands: readonly ClimbBand[], layer: number): number {
  return Math.max(
    0,
    bands.findIndex((band) => layer <= band.to),
  );
}

/**
 * The layout of the climb map ribbon, bottom-up: the Classic zones, then laps of Space up to one
 * above the highest reached, the marks on their heights and the goal (docs/07-ui-screens.md,
 * section 2.3).
 */
export function climbMap(input: ClimbMapInput): ClimbMap {
  const record = Math.max(0, Math.floor(input.record ?? 0));
  const size = BALANCE.zones.length;
  const reached = Math.max(Math.floor(input.bestLap), spaceLap(record));
  const bands: ClimbBand[] = [];
  ZONES.forEach((zone, i) => {
    if (i >= SPACE_ZONE_INDEX) return;
    const from = i * size + 1;
    bands.push({
      kind: 'zone',
      zone: zone.id,
      lap: 0,
      from,
      to: from + size - 1,
      open: i === 0 || record >= from,
    });
  });
  const laps = Math.max(1, reached + 1);
  for (let lap = 1; lap <= laps; lap++) {
    const from = lapFirstIndex(lap);
    bands.push({
      kind: 'lap',
      zone: 'space',
      lap,
      from,
      to: from + size - 1,
      open: record >= from,
    });
  }

  const marks: ClimbMark[] = [];
  if (input.record !== null && record > 0) {
    marks.push({ kind: 'record', height: record, band: bandIndexOf(bands, record), value: record });
    if (input.todayBest > 0 && input.todayBest < record) {
      const today = Math.floor(input.todayBest);
      marks.push({ kind: 'today', height: today, band: bandIndexOf(bands, today), value: today });
    }
  }
  for (const height of input.checkpoints) {
    marks.push({ kind: 'checkpoint', height, band: bandIndexOf(bands, height), value: height });
  }
  if (reached >= BEST_LAP_FROM) {
    const first = lapFirstIndex(reached);
    marks.push({ kind: 'bestLap', height: first, band: bandIndexOf(bands, first), value: reached });
  }
  marks.sort((a, b) => a.height - b.height);

  // The last band is always shut (laps run one above the highest reached), so a goal exists.
  const next = bands.findIndex((band) => !band.open);
  const target = bands[next] as ClimbBand;
  const last = bands[bands.length - 1] as ClimbBand;
  return {
    bands,
    marks,
    goal: { band: next, layers: target.from - record },
    anchor: record,
    totalLayers: last.to,
  };
}
