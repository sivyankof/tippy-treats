import { PALETTE } from './palette';
import type { HopMotion } from './hop-motion';

/**
 * Look of the chest of the day drawn like the plain layers: flat two-tone fill, thick outline, a
 * stroke-and-dot highlight, two gold bands, a lock and a small face (docs/06-art-animation-audio.md,
 * section 6). Sizes are in design pixels; shares are of the body height unless said otherwise.
 */
export const CHEST_LOOK = {
  size: {
    /** Width of the body, height of the body, height of the lid, and how far the lid covers the top of the body. */
    width: 230,
    bodyHeight: 120,
    lidHeight: 104,
    lidOverlap: 10,
    /** The lid is a little wider than the body on each side. */
    lidOverhang: 6,
  },
  colors: {
    wood: 0xeab36a,
    woodShadow: 0xc98448,
    lid: 0xb5603a,
    lidShadow: 0x93482b,
    /** The dark lip along the bottom edge of the lid. */
    lip: 0x6b3220,
    /** The inside of the lid seen when it is open, and the dark inside of the open body. */
    lidInside: 0xb8793f,
    lidInsideShadow: 0x93602f,
    inside: 0x4a2a1c,
    metal: PALETTE.gold,
    metalShadow: 0xe0a21c,
    gloss: 0xffffff,
    face: PALETTE.textDark,
    /** The flat light rays behind a ready chest. */
    rays: 0xffd966,
  },
  /** Corner shapes: the body, the dome of the lid (top corners as a share of the half sizes), its bottom corners, the open lid. */
  bodyRound: 0.22,
  dome: { top: 1, bottom: 0.15 },
  insideRound: 0.3,
  /** The shadow band as a share of the half sizes (body, lid) and of the band width (the metal straps). */
  bodyBand: 0.08,
  lidBand: 0.14,
  /** The lip band along the bottom of the lid: height and how far it stops short of the sides. */
  lip: { height: 9, inset: 4 },
  strapShadowShare: 0.26,
  /** Safety margin around the baked pictures, pixels. */
  texturePad: 4,
  /** The two straps: distance from the middle as a share of the width, and their width. */
  strap: { x: 0.3, width: 34 },
  /** The lock plate on the body, below the lid seam: size, how far its middle is below the top of the body, corner share. */
  lock: {
    width: 48,
    height: 42,
    drop: 48,
    round: 0.3,
    keyholeRadius: 6,
    /** The keyhole circle sits this share of its radius above the middle of the plate. */
    keyholeLift: 0.4,
    keyholeSlotWidth: 5,
    keyholeSlotHeight: 12,
  },
  gloss: {
    x: -0.3,
    y: -0.2,
    length: 0.3,
    thick: 0.07,
    tiltDeg: -10,
    dotGap: 0.05,
    dotRadius: 0.03,
    alpha: 0.9,
  },
  /** Face on the body, between the straps and under the lock. */
  face: {
    eyeY: 0.22,
    eyeSpacing: 0.4,
    eyeRadius: 0.06,
    smileY: 0.4,
    smileRadius: 0.1,
    smileSpanDeg: 100,
    smileThick: 0.045,
  },
  /** The opening of the open body: half width as a share of the body half width, half height as a share of the body height, and the inside ring. */
  opening: { widthShare: 0.84, ry: 0.14, innerShare: 0.8 },
  /** The inside of the open lid: its height as a share of the lid height. */
  insideLidShare: 0.8,
} as const;

/** The motion of the chest in the missions window and its light rays. */
export interface ChestMotion extends HopMotion {
  rays: {
    count: number;
    radius: number;
    /** The rays are flattened to this share of their height so they stay inside the card. */
    squashY: number;
    /** One full turn of the rays, and the pulse of their scale and alpha (one way). */
    turnMs: number;
    pulseMs: number;
    scale: { from: number; to: number };
    alpha: { from: number; to: number };
  };
  /** The lid flips shut-to-open: first it folds flat, then pops up inside out. */
  open: { foldMs: number; popMs: number };
}
