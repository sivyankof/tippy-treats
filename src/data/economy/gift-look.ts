import { PALETTE } from '../common/palette';

/**
 * Look of the gift box drawn like the plain layers: flat two-tone fill, thick outline, a stroke-and-dot
 * highlight, a ribbon cross and a bow (docs/06-art-animation-audio.md, section 6). Sizes of the box itself
 * (`boxSize`, `lidHeight`, `lidOverhang`, `ribbonWidth`, `bowSize`) are in `MENU.newCreature`; shares here
 * are of the body height unless said otherwise, angles are degrees.
 */
export const GIFT_LOOK = {
  colors: {
    box: 0xff9ecf,
    boxShadow: 0xe676b0,
    lid: 0xff5c8a,
    lidShadow: 0xd63d6c,
    ribbon: 0xffc93c,
    ribbonShadow: 0xe0a21c,
    gloss: 0xffffff,
    /** The dark inside of the opened box. */
    inside: 0x6b2748,
    face: PALETTE.textDark,
  },
  /** Corner radius as a share of the smaller half size of the body and the lid. */
  bodyRound: 0.3,
  lidRound: 0.5,
  /** The shadow band of the body and the lid (share of the half sizes), and of the ribbon (share of its width). */
  bodyBand: 0.1,
  lidBand: 0.16,
  ribbonBand: 0.24,
  /** Safety margin around the baked pictures, pixels. */
  texturePad: 4,
  /** Bow proportions, shares of `bowSize`. */
  bow: {
    loopRx: 0.55,
    loopRy: 0.38,
    /** The loop centre: sideways from the middle and up from the top of the lid. */
    loopX: 0.52,
    loopRise: 0.3,
    tiltDeg: 24,
    /** The dark hollow of each loop: its size against the loop and its offset in the loop's own half sizes. */
    hollow: 0.5,
    hollowShift: 0.18,
    knotRx: 0.26,
    knotRy: 0.24,
    knotRise: 0.12,
    band: 0.18,
  },
  /** Highlight stroke and dot (shares of the body height; tilt in degrees). */
  gloss: {
    body: {
      x: -0.36,
      y: -0.22,
      length: 0.22,
      thick: 0.06,
      tiltDeg: -60,
      dotGap: 0.05,
      dotRadius: 0.03,
    },
    lid: {
      x: -0.36,
      y: -0.04,
      length: 0.2,
      thick: 0.05,
      tiltDeg: 0,
      dotGap: 0.04,
      dotRadius: 0.022,
    },
    alpha: 0.9,
  },
  /** The face on the large box: eyes either side of the ribbon, a smile below. */
  face: {
    eyeY: -0.02,
    eyeSpacing: 0.62,
    eyeRadius: 0.075,
    smileY: 0.22,
    smileRadius: 0.14,
    smileSpanDeg: 100,
    smileThick: 0.05,
  },
  /** The opening of the box once the lid is off: a ring and a dark inside centred on the top edge. */
  opening: {
    /** Half width as a share of the box width, half height as a share of the body height. */
    widthShare: 0.86,
    ry: 0.13,
    /** The inside is smaller than the ring by this share. */
    innerShare: 0.78,
  },
} as const;
