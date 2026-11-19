import type * as Phaser from 'phaser';
import { MASTERY_FRAME } from '../../data/creatures/mastery-look';
import { parseHex } from '../../util/color';
import { fillOutlinedPolygon } from '../fx/plain-style';
import { starPoints } from '../objects/creature-art/rainbow-geometry';
import { bakeTexture } from './bake-texture';
import {
  COLLECTION_BODY,
  crownSpot,
  isCollectionBody,
  masteryFramePad,
  type FrameBody,
} from './mastery-frame-geometry';

/**
 * Texture key of the gold mastery frame (docs/06, "Золотая рамка"): a ring the shape and size of
 * the rarity rim of a collection card with a second thin rim outside it and a crown-star on the top
 * centre, drawn over the card of a level-5 creature. Its centre is transparent; bake it with `bakeMasteryFrame` first.
 */
export const MASTERY_FRAME_KEY = MASTERY_FRAME.key;

/** Size of the picture: the plate plus the room around it for the outer rim and the crown. */
export function masteryFrameSize(body: FrameBody = COLLECTION_BODY): FrameBody {
  const pad = masteryFramePad();
  return { width: body.width + pad * 2, height: body.height + pad * 2 };
}

/** Texture key of the frame of a plate: the shared key for the collection card, one per other size. */
export function masteryFrameKey(body: FrameBody = COLLECTION_BODY): string {
  return isCollectionBody(body)
    ? MASTERY_FRAME_KEY
    : `${MASTERY_FRAME_KEY}_${body.width}x${body.height}`;
}

/** The light inner star of the crown, as a share of its radius. */
const CROWN_LIGHT_SHARE = 0.55;
const GLINT_RADIUS_SHARE = 0.22;

/** Bakes the gold frame of a plate once (the key is kept when it exists); returns the key. Put it at the plate centre. */
export function bakeMasteryFrame(scene: Phaser.Scene, body: FrameBody = COLLECTION_BODY): string {
  const size = masteryFrameSize(body);
  const key = masteryFrameKey(body);
  bakeTexture(scene, key, size.width, size.height, (g) => {
    const f = { ...MASTERY_FRAME, width: body.width, height: body.height };
    const gold = parseHex(f.gold);
    const light = parseHex(f.goldLight);
    const dark = parseHex(f.goldDark);
    const ring = f.outline + f.band;
    const x = masteryFramePad();
    const y = x;
    const stroke = (inset: number, width: number, color: number, alpha = 1): void => {
      g.lineStyle(width, color, alpha);
      g.strokeRoundedRect(
        x + inset,
        y + inset,
        f.width - inset * 2,
        f.height - inset * 2,
        Math.max(0, f.radius - inset),
      );
    };
    stroke(ring / 2, ring, dark);
    stroke(f.outline + f.band / 2, f.band, gold);
    stroke(f.outline + f.band * 0.2, f.band * 0.28, light, 0.9);
    stroke(f.outline + f.band, 2, dark, 0.55);
    // A shine along the top of the band, kept off the corners.
    g.lineStyle(f.shine.height, parseHex(f.goldLight), f.shine.alpha);
    g.beginPath();
    g.moveTo(x + f.shine.inset, y + f.outline + f.band * 0.5);
    g.lineTo(x + f.width - f.shine.inset, y + f.outline + f.band * 0.5);
    g.strokePath();
    // Second thin rim outside the band.
    const o = f.outerRim;
    const outerInset = -(o.gap + o.width / 2 + o.outline);
    stroke(outerInset, o.width + o.outline * 2, dark);
    stroke(outerInset, o.width, gold);
    stroke(outerInset - o.width * o.shineShift, o.width * o.shineWidth, light, o.shineAlpha);
    // Crown-star over both rims: top centre on the card, top-left corner on other plates.
    const spot = crownSpot(body);
    const cx = x + spot.cx;
    const cy = y + spot.cy;
    const r = spot.r;
    fillOutlinedPolygon(
      g,
      starPoints(cx, cy, r, f.crown.notch, f.crown.points),
      gold,
      dark,
      f.crown.outline,
    );
    fillOutlinedPolygon(
      g,
      starPoints(cx, cy, r * CROWN_LIGHT_SHARE, f.crown.notch, f.crown.points),
      light,
      light,
      0,
    );
    g.fillStyle(parseHex(f.crown.white), 1);
    g.fillCircle(cx, cy, r * GLINT_RADIUS_SHARE);
  });
  return key;
}
