import type { ClimbBand } from '../../../core/progression/climb-map';
import { Rng } from '../../../core/common/rng';
import { MENU } from '../../../data/common/menu-layout';
import { CLIMB_LANDSCAPE, type LandscapeKind } from '../../../data/progression/climb-landscape';
import { CLIMB_MAP } from '../../../data/progression/climb-map';
import { SPACE_PLANET_IDS, type SpacePlanetId } from '../../../data/zones/space-planets';
import { mixColor } from '../../../util/color';

const L = CLIMB_LANDSCAPE;

/** Height of one picture of the ribbon: one band. */
export const LAND_H = CLIMB_MAP.bandHeight;

/** Width of the strip of the ribbon, which is the width of every picture: the window minus its padding and the rim. */
export function climbStripWidth(): number {
  return MENU.popup.width - MENU.popup.padX * 2 - CLIMB_MAP.frame.thick * 2;
}

/** The picture a band shows: its zone, or `lap` for the laps of Space. */
export function landscapeKind(band: ClimbBand): LandscapeKind {
  return band.kind === 'lap' ? 'lap' : (band.zone as Exclude<LandscapeKind, 'lap'>);
}

/**
 * The look a lap of Space takes: the laps walk the nine planets in turn, and lap 10 looks like lap
 * 1 again. Neighbouring laps always differ, while a strong player's map holds no more than nine
 * lap pictures however high the record is.
 */
export function lapLook(lap: number): number {
  const n = SPACE_PLANET_IDS.length;
  return ((((Math.max(1, Math.floor(lap)) - 1) % n) + n) % n) + 1;
}

/** Cache key of a picture: a shut one is a different picture, and every look of a lap has its own. */
export function landscapeKey(kind: LandscapeKind, lap: number, shut: boolean): string {
  const name = kind === 'lap' ? `lap${lapLook(lap)}` : kind;
  return `climb_map_land_${name}${shut ? '_fog' : ''}`;
}

/** The dessert planet of a lap of Space: the laps walk the nine planets in turn. */
export function lapPlanet(lap: number): SpacePlanetId {
  const n = SPACE_PLANET_IDS.length;
  const i = (((Math.max(1, lap) - 1) % n) + n) % n;
  return SPACE_PLANET_IDS[i] as SpacePlanetId;
}

/** The sky colour at `p` bands from the foot of the ribbon: the gradient up to the Stars, then the lap sky (its ends are equal, so laps join). */
export function skyColorAt(p: number): number {
  const stops = L.sky;
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (p <= first.p) return first.color;
  if (p >= last.p) {
    const u = (p - last.p) % 1;
    return mixColor(L.lapSky.edge, L.lapSky.mid, 1 - Math.abs(2 * u - 1));
  }
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (a && b && p <= b.p) return mixColor(a.color, b.color, (p - a.p) / (b.p - a.p));
  }
  return last.color;
}

/** Where the sign of a band stands in the picture: left, top, width and height (picture pixels). */
export function signRect(
  kind: LandscapeKind,
  shut = false,
): { x: number; y: number; width: number; height: number } {
  const s = L.sign;
  const centre = LAND_H / 2 + signCentreOffset(kind, shut);
  return {
    x: s.left + (shut ? 0 : (s.leftDx[kind] ?? 0)),
    y: centre - s.height / 2,
    width: s.width,
    height: s.height,
  };
}

/** The centre of the sign of a band, as an offset from the middle of the band. */
export function signCentreOffset(kind: LandscapeKind, shut = false): number {
  return (shut ? L.sign.shutDy : L.sign.centreDy)[kind];
}

/** The strip y (0 at the top of the strip) of the top of the band that holds the record: the fog edge stands there. */
export function fogBoundary(recordBand: number, bandCount: number): number {
  return (bandCount - 1 - recordBand) * LAND_H;
}

/** Index of the lowest shut band, or the band count when none is shut. */
export function firstShutBand(bands: readonly { open: boolean }[]): number {
  const i = bands.findIndex((band) => !band.open);
  return i < 0 ? bands.length : i;
}

export interface Puff {
  x: number;
  y: number;
  r: number;
}

/**
 * The puffs along the lower edge of the fog: `count` round puffs spread over `width` (the ends
 * reach past it), the sizes and heights from a seeded stream so the edge is not a ruler.
 * `y` is the offset from the line of the edge, positive down.
 */
export function puffLayout(
  seed: number,
  width: number,
  count: number,
  radius: readonly [number, number],
): Puff[] {
  const rng = new Rng(seed);
  const step = width / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const r = rng.range(radius[0], radius[1]);
    return {
      x: i * step + rng.range(-step * 0.12, step * 0.12),
      y: rng.range(-r * 0.15, r * 0.25),
      r,
    };
  });
}

/** Where the planet of a lap stands: its centre and scale. */
export interface PlanetSpot {
  x: number;
  y: number;
  scale: number;
}

/**
 * The spot of the planet of `lap` in the left column: a scale from the lap's seeded stream, then a centre that keeps the whole
 * picture (`width` x `height` px at scale 1) inside the box. Every lap gets its own size and place.
 */
export function planetSpot(
  lap: number,
  width: number,
  height: number,
  ringed: boolean,
  comet: boolean,
): PlanetSpot {
  const p = L.lap.planet;
  const rng = new Rng(300 + Math.max(1, lap) * 17);
  const fits = (p.box.bottom - p.box.top) / height;
  const top = Math.min(fits, ringed ? p.ringedMaxScale : p.scale[1]);
  const scale = rng.range(p.scale[0], Math.max(p.scale[0], top));
  const halfW = (width * scale) / 2;
  const halfH = (height * scale) / 2;
  const right = comet ? p.rightWithComet : p.right;
  const xLo = p.box.left + halfW;
  const yLo = p.box.top + halfH;
  return {
    x: rng.range(xLo, Math.max(xLo, right - halfW)),
    y: rng.range(yLo, Math.max(yLo, p.box.bottom - halfH)),
    scale,
  };
}
