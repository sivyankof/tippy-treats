import { nominalSpeed, zoneIndexOf } from '../src/core/zones';
import { BALANCE } from '../src/data/balance';
import { ZONES } from '../src/data/zones';
import { MS_PER_SECOND } from '../src/util/math';

/**
 * `npm run sim:speed` part 1: the nominal flying speed of every layer from 1 to 160 and the time a
 * layer needs to cross the field. Nominal means without the ability multiplier, the rush
 * (x1.35 on rush layers of Showcase) and the roof profile (x0.8 at the walls, x1 in the middle).
 */

const LAST_LAYER = 160;
const TABLE_STEP = 5;
const CROSSING_LAYERS = [1, 20, 40, 60, 80, 100, 120];

/** The distance the centre of a layer travels between the two walls, px. */
const TRACK_PX = BALANCE.layer.maxCenterX - BALANCE.layer.minCenterX;

/** Layer `n` spawns above a tower of `n - 1` layers. */
const speedOfLayer = (layer: number): number => nominalSpeed(layer - 1, zoneIndexOf(layer), 1);

const rawCapLayer = Array.from({ length: LAST_LAYER }, (_, i) => i + 1).find(
  (layer) => BALANCE.speed.base + BALANCE.speed.perLayer * (layer - 1) >= BALANCE.speed.max,
);

/** The zone cap (Space) limits the speed of this layer. */
function isCapped(layer: number): boolean {
  const cap = ZONES[zoneIndexOf(layer)]?.speedCap ?? null;
  return cap !== null && nominalSpeedUncapped(layer) >= cap;
}

/** What changes at this layer; a cap is marked where it first takes hold. */
function notes(layer: number): string {
  const zone = ZONES[zoneIndexOf(layer)];
  const marks: string[] = [];
  if (layer === rawCapLayer) marks.push(`base growth hits the cap ${BALANCE.speed.max}`);
  if (isCapped(layer) && !isCapped(layer - 1))
    marks.push(`${zone?.id} cap ${zone?.speedCap} in force`);
  if (layer > 1 && zoneIndexOf(layer) !== zoneIndexOf(layer - 1))
    marks.push(`zone ${zone?.id} starts`);
  return marks.join('; ');
}

/** Speed the layer would have without the zone cap (raw growth capped at `max`, times the zone). */
function nominalSpeedUncapped(layer: number): number {
  const raw = Math.min(
    BALANCE.speed.max,
    BALANCE.speed.base + BALANCE.speed.perLayer * (layer - 1),
  );
  return raw * (ZONES[zoneIndexOf(layer)]?.speedMult ?? 1);
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
