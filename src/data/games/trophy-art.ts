import { PALETTE } from '../common/palette';
import { MENU } from '../common/menu-layout';
import type { JournalPart } from '../progression/journal-art';

/** Colours of the trophy: gold cup, a cream star, a brown base. */
const C = {
  gold: PALETTE.gold,
  goldShadow: 0xe0a020,
  star: 0xfff3d6,
  starShadow: 0xf2d9a6,
  base: 0x9a6340,
  baseShadow: 0x7c4c2e,
  white: 0xffffff,
} as const;

/**
 * The trophy of the game services (docs/07-ui-screens.md, section 10): a gold cup with two
 * handles, a star on it, a stem and a base, drawn by the parts of the journal icons (shares of the
 * picture). The holes of the handles take the fill of the button it sits on.
 */
export const TROPHY_ART = {
  /** Baked size, texture pixels. */
  size: 96,
  parts: [
    {
      shape: { kind: 'round', radius: 0.5 },
      x: 0.5,
      y: 0.88,
      rx: 0.27,
      ry: 0.07,
      fill: C.base,
      shadow: C.baseShadow,
    },
    {
      shape: { kind: 'round', radius: 0.6 },
      x: 0.5,
      y: 0.73,
      rx: 0.07,
      ry: 0.1,
      fill: C.gold,
      shadow: C.goldShadow,
    },
    {
      shape: { kind: 'ellipse' },
      x: 0.2,
      y: 0.36,
      rx: 0.13,
      ry: 0.14,
      fill: C.gold,
      shadow: C.goldShadow,
    },
    {
      shape: { kind: 'ellipse' },
      x: 0.8,
      y: 0.36,
      rx: 0.13,
      ry: 0.14,
      fill: C.gold,
      shadow: C.goldShadow,
    },
    {
      shape: { kind: 'ellipse' },
      x: 0.2,
      y: 0.36,
      rx: 0.06,
      ry: 0.07,
      fill: MENU.gamesButton.fill,
      flat: true,
    },
    {
      shape: { kind: 'ellipse' },
      x: 0.8,
      y: 0.36,
      rx: 0.06,
      ry: 0.07,
      fill: MENU.gamesButton.fill,
      flat: true,
    },
    {
      shape: { kind: 'round', radius: 0.55 },
      x: 0.5,
      y: 0.4,
      rx: 0.28,
      ry: 0.25,
      fill: C.gold,
      shadow: C.goldShadow,
    },
    {
      shape: { kind: 'star', inner: 0.46, tips: 5 },
      x: 0.5,
      y: 0.4,
      rx: 0.13,
      ry: 0.13,
      fill: C.star,
      shadow: C.starShadow,
    },
    {
      shape: { kind: 'round', radius: 1 },
      x: 0.33,
      y: 0.3,
      rx: 0.03,
      ry: 0.08,
      fill: C.white,
      flat: true,
      alpha: 0.7,
    },
  ] as readonly JournalPart[],
} as const;
