import type { ClimbBand, ClimbMap } from '../../../../core/progression/climb-map';
import { t, tn } from '../../../../i18n';

/** Name of a band: the zone, "Space" for lap 1 of it, "Lap N" for the laps after. */
export function bandName(band: ClimbBand): string {
  if (band.kind === 'zone' || band.lap === 1) return t(`zone.${band.zone}.name`);
  return t('zone.lap', { n: band.lap });
}

/** The goal row: the layers from the record to the first layer of the next band, "14 layers to Clouds". */
export function goalText(map: ClimbMap): string {
  const target = map.bands[map.goal.band];
  if (!target) return '';
  const key =
    target.kind === 'zone' || target.lap === 1
      ? `climbMap.goal.${target.zone}`
      : 'climbMap.goal.lap';
  return tn(key, map.goal.layers, { lap: target.lap });
}
