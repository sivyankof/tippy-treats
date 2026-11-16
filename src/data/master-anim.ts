import { parseHex } from '../util/color';
import { CREATURES } from './creatures';
import { HUD_LAYOUT } from './hud-layout';
import { PALETTE } from './palette';

const LEMON = parseHex(CREATURES.lemon.palette.glaze);
const LEMON_PALE = 0xfff3a0;

/**
 * Looks of the master effects in a run (docs/06-art-animation-audio.md, section 4, "Мастер-эффекты
 * и новые свойства в забеге"). Only looks live here: what a master effect pays and when it acts is
 * decided by the core (`data/mastery.ts`) and arrives as an event. Times are milliseconds,
 * distances logical pixels.
 */
export const MASTER_ANIM = {
  /** The master caption: a small gold plate by the effect badge row of the HUD. */
  caption: {
    /** Appears with `backOut` from `fromScale`, holds, fades. A repeat during the show extends the hold. */
    inMs: 160,
    holdMs: 900,
    outMs: 250,
    inEase: 'Back.easeOut',
    fromScale: 0.6,
    height: 70,
    padX: 20,
    nameFont: 40,
    sumFont: 44,
    starSize: 44,
    starGap: 10,
    /** The sum is laid out for this many digits, so the baked plate never changes width mid-run. */
    sumDigits: 3,
    nameStroke: 7,
    /** Gold star and sum colour. */
    gold: PALETTE.gold,
    /** The spark at the star when the caption appears (full level only). */
    spark: { ms: 380, scaleTo: 2.2, spinDeg: 120 },
    /**
     * Placement: at the right of the badge when the badge is the last of the row and the plate
     * ends before `rightReserve` pixels from the right edge (the next creature indicator lives
     * there; "через 5 слоёв" is its widest text); otherwise under the row, centre y `belowY`.
     */
    gap: 14,
    rightReserve: 620,
    belowY: HUD_LAYOUT.bottomEdge + 96,
  },
  /** Ghost centre mark (level 2+): a small diamond on the middle of the top edge of the top layer. */
  centreMark: {
    size: 30,
    pulse: [1, 1.15] as readonly [number, number],
    periodMs: 1000,
    alpha: 0.95,
  },
  /** Lemon "Swagger": a salute up from the top layer, and the vignette flares once. */
  lemon: {
    count: 12,
    colors: [LEMON, LEMON_PALE, 0xffffff],
    style: {
      speed: [380, 640],
      gravity: 900,
      drag: 1.2,
      spin: [-360, 360],
      scale: [0.7, 1.2],
      scaleTo: 0.4,
      alpha: 1,
      holdShare: 0.5,
      lifeMs: [600, 900],
      spreadDeg: 70,
      tiltDeg: 0,
    },
    flashAlpha: 1,
    flashMs: 450,
  },
  /** Twins "Peace": the faces lean together, a heart floats up. */
  twins: {
    leanShare: 0.2,
    leanMs: 600,
    heartRisePx: 40,
    heartMs: 700,
    heartScale: 1.1,
    heartLiftY: 30,
  },
  /** Puff "Sugar dust": a white puff from both sides of the widened layer and the score floats up. */
  puff: {
    count: 8,
    color: 0xffffff,
    style: {
      speed: [120, 260],
      gravity: -20,
      drag: 2.4,
      spin: [-90, 90],
      scale: [0.6, 1.1],
      scaleTo: 1.6,
      alpha: 0.9,
      holdShare: 0.3,
      lifeMs: [450, 750],
      spreadDeg: 80,
      tiltDeg: 25,
    },
    textLiftY: 40,
  },
  /** Score label of the master effects and of the rainbow protected layer ("+N"). */
  scoreLabel: { liftY: 50 },
} as const;
