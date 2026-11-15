import { KITCHEN_COLORS, PALETTE } from './palette';

/** The picture "Share" makes of a finished run (docs/07-ui-screens.md, section 6). */
export const SHARE_CARD = {
  /** Size of the picture in pixels. */
  width: 1080,
  height: 1350,
  /** File name offered to the share target or the downloads folder. */
  fileName: 'tippy-treats-tower.png',
  mimeType: 'image/png',
  /** Sky gradient from the top edge to the worktop, drawn as this many bands. */
  skyBands: 24,
  skyTop: KITCHEN_COLORS.skyTop,
  skyBottom: KITCHEN_COLORS.skyBottom,
  /** The worktop under the tray. */
  counter: KITCHEN_COLORS.counter,
  counterTop: KITCHEN_COLORS.counterTop,
  /** The worktop edge starts this much below the tray's top surface, as a share of the tray thickness. */
  counterOverlapShare: 0.6,
  counterTopHeight: 22,
  /** The game name on top. */
  title: { y: 130, font: 128, color: PALETTE.accent },
  /** The height line under the name. */
  heightLine: { y: 270, font: 84, color: PALETTE.gold },
  /** Where the tower may stand: the tray's top surface rests on `trayY`, layers rise up to `top`. */
  tower: { top: 380, trayY: 1190, sideMargin: 70 },
  /** A short tower is enlarged to fill the room, but not beyond this scale. */
  maxScale: 2.5,
  /** Tray look in the picture (drawn at the scale of the tower). */
  tray: {
    fill: KITCHEN_COLORS.tray,
    shadow: KITCHEN_COLORS.trayShadow,
    radius: 14,
    faceShare: 0.8,
  },
} as const;
