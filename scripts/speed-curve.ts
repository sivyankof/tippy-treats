import { layerSpeed } from '../src/core/tower/drop';
import { zoneIndexOf } from '../src/core/zones/zones';
import { BALANCE } from '../src/data/tower/balance';
import { ZONES } from '../src/data/zones/zones';
import { MS_PER_SECOND } from '../src/util/math';

/**
 * `npm run sim:speed` part 1: the nominal flying speed of every layer from 1 to 165 and the time a
 * layer needs to cross the field. Nominal means without the ability multiplier, the rush
 * (`ZONE_RULES.rush`: `speedMult`, in Space at most `spaceMaxSpeed`) and the roof profile.
 * One speed curve for the whole tower (core/tower/speed-curve.ts): zones do not change the speed.
 */

const LAST_LAYER = 165;
const TABLE_STEP = 5;
const CROSSING_LAYERS = [1, 20, 40, 60, 80, 100, 120];

/** The distance the centre of a layer travels between the two walls, px. */
const TRACK_PX = BALANCE.layer.maxCenterX - BALANCE.layer.minCenterX;

/** Layer `n` spawns above a tower of `n - 1` layers. */
const speedOfLayer = (layer: number): number => layerSpeed(layer - 1, 1);

/** What changes at this layer: the start of a zone and the bends of the curve. */
function notes(layer: number): string {
  const zone = ZONES[zoneIndexOf(layer)];
  const { arcTo, top } = BALANCE.speed;
  const marks: string[] = [];
  if (layer - 1 === arcTo) marks.push(`the curve reaches ${top}`);
  if (layer > 1 && zoneIndexOf(layer) !== zoneIndexOf(layer - 1))
    marks.push(`zone ${zone?.id} starts`);
  return marks.join('; ');
}

console.log(
  `Nominal flying speed per layer (px/s), every ${TABLE_STEP}th layer plus the layers where something changes`,
);
const rows = Array.from({ length: LAST_LAYER }, (_, i) => i + 1)
  .filter((layer) => layer === 1 || layer % TABLE_STEP === 0 || notes(layer) !== '')
  .map((layer) => ({
    layer,
    zone: ZONES[zoneIndexOf(layer)]?.id ?? '-',
    'speed, px/s': Math.round(speedOfLayer(layer)),
    note: notes(layer),
  }));
console.table(rows);

console.log(
  `\nCrossing time: the centre of a layer travels ${TRACK_PX} px between the walls ` +
    `(minCenterX ${BALANCE.layer.minCenterX} .. maxCenterX ${BALANCE.layer.maxCenterX}), no roof or rush factor`,
);
console.table(
  CROSSING_LAYERS.map((layer) => ({
    layer,
    zone: ZONES[zoneIndexOf(layer)]?.id ?? '-',
    'speed, px/s': Math.round(speedOfLayer(layer)),
    'one crossing, ms': Math.round((TRACK_PX / speedOfLayer(layer)) * MS_PER_SECOND),
  })),
);
