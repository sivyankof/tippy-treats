import type { CutSide } from '../../../core/tower/drop';
import type { PlacedLayer } from '../../../core/tower/sim-types';

/** One placed layer as the share picture needs it. */
export type SnapshotLayer = Pick<PlacedLayer, 'kind' | 'creature' | 'level' | 'x' | 'width'>;

/** The finished tower as plain data: copied when the run ends, so it outlives the live views. */
export interface TowerSnapshot {
  /** Bottom to top. */
  layers: readonly SnapshotLayer[];
  /** The bitten edge of each layer (same order); `null` for an intact one. */
  cuts: ReadonlyArray<CutSide | null>;
}

/** Copies what the picture needs out of the live layers. */
export function snapshotTower(
  layers: readonly PlacedLayer[],
  cuts: ReadonlyArray<CutSide | null | undefined>,
): TowerSnapshot {
  return {
    layers: layers.map(({ kind, creature, level, x, width }) => ({
      kind,
      creature,
      level,
      x,
      width,
    })),
    cuts: layers.map((_, i) => cuts[i] ?? null),
  };
}
