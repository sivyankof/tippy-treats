import { MASTERY_FRAME } from '../../data/creatures/mastery-look';

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
