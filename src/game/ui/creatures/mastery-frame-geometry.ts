import { MASTERY_FRAME } from '../../../data/creatures/mastery-look';

/** The plate a frame wraps: the collection card unless given. */
export interface FrameBody {
  width: number;
  height: number;
}

export const COLLECTION_BODY: FrameBody = {
  width: MASTERY_FRAME.width,
  height: MASTERY_FRAME.height,
};

/** True for the collection card (it has its own crown and shares one texture key). */
export function isCollectionBody(body: FrameBody): boolean {
  return body.width === COLLECTION_BODY.width && body.height === COLLECTION_BODY.height;
}

/** Centre and radius of the crown-star, as offsets from the top-left corner of the plate. */
export interface CrownSpot {
  cx: number;
  cy: number;
  r: number;
}

/** Where the crown sits on a plate: top centre of the card, top-left corner of any other plate. */
export function crownSpot(body: FrameBody): CrownSpot {
  const f = MASTERY_FRAME;
  if (isCollectionBody(body)) {
    return { cx: body.width / 2, cy: -f.cardCrown.lift, r: f.cardCrown.r };
  }
  return { cx: f.windowCrown.inset, cy: -f.windowCrown.lift, r: f.windowCrown.r };
}

/** How far the crown (with its outline) reaches above the plate top edge. */
function crownReach(spot: CrownSpot): number {
  return spot.r - spot.cy + MASTERY_FRAME.crown.outline;
}

/** How far the outer rim (gap, gold and both dark outlines) reaches outside the plate edge. */
export function outerRimReach(): number {
  const o = MASTERY_FRAME.outerRim;
  return o.gap + o.width + o.outline * 2;
}

/** Room the picture keeps around the plate: whatever sticks out furthest, the widest crown or the outer rim. */
export function masteryFramePad(): number {
  const crowns = [
    crownReach(crownSpot(COLLECTION_BODY)),
    // Any plate other than the card wears the window crown; its size does not move the crown.
    crownReach(crownSpot({ width: 0, height: 0 })),
  ];
  return Math.ceil(Math.max(outerRimReach(), ...crowns));
}

/** A point on the centre line of the gold band, as an offset from the plate centre, with the direction of travel. */
export interface PerimeterPoint {
  x: number;
  y: number;
  /** Direction of travel (clockwise), radians. */
  angle: number;
}

/** The centre line of the gold band: a rounded rectangle half-size and corner radius. */
function bandLine(body: FrameBody): { hw: number; hh: number; r: number } {
  const f = MASTERY_FRAME;
  const inset = f.outline + f.band / 2;
  return {
    hw: body.width / 2 - inset,
    hh: body.height / 2 - inset,
    r: Math.max(0, f.radius - inset),
  };
}

/** Where the sparkle starts and ends on the top edge (x offset from the plate centre): under the crown. */
export function sparkleStartX(body: FrameBody): number {
  const { hw, r } = bandLine(body);
  const straight = hw - r;
  return Math.max(-straight, Math.min(straight, crownSpot(body).cx - body.width / 2));
}

/**
 * The point at share `t` of the way once round the centre line of the gold band, clockwise from the top edge at
 * `startX`. The speed is the same on the straight edges and the corner arcs; `t` wraps, so 0 and 1 are the same point.
 */
export function framePerimeterPoint(body: FrameBody, t: number, startX = 0): PerimeterPoint {
  const { hw, hh, r } = bandLine(body);
  const a = 2 * (hw - r);
  const b = 2 * (hh - r);
  const arc = (Math.PI / 2) * r;
  const total = 2 * a + 2 * b + 4 * arc;
  const from = Math.max(-(hw - r), Math.min(hw - r, startX)) + (hw - r);
  let d = (((from + t * total) % total) + total) % total;
  // Pieces in travel order from the top-left end of the top edge: edge, corner, edge, corner...
  const lengths = [a, arc, b, arc, a, arc, b, arc];
  const half = Math.PI / 2;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i] ?? 0;
    if (d > len && i < lengths.length - 1) {
      d -= len;
      continue;
    }
    const u = len > 0 ? Math.min(1, d / len) : 0;
    switch (i) {
      case 0:
        return { x: -(hw - r) + d, y: -hh, angle: 0 };
      case 1:
        return arcPoint(hw - r, -(hh - r), r, -half + u * half);
      case 2:
        return { x: hw, y: -(hh - r) + d, angle: half };
      case 3:
        return arcPoint(hw - r, hh - r, r, u * half);
      case 4:
        return { x: hw - r - d, y: hh, angle: Math.PI };
      case 5:
        return arcPoint(-(hw - r), hh - r, r, half + u * half);
      case 6:
        return { x: -hw, y: hh - r - d, angle: -half };
      default:
        return arcPoint(-(hw - r), -(hh - r), r, Math.PI + u * half);
    }
  }
  return { x: 0, y: -hh, angle: 0 };
}

/** A point on a corner arc at polar angle `phi` around (cx, cy); the direction of travel is a quarter turn ahead. */
function arcPoint(cx: number, cy: number, r: number, phi: number): PerimeterPoint {
  return { x: cx + Math.cos(phi) * r, y: cy + Math.sin(phi) * r, angle: phi + Math.PI / 2 };
}
