import type { CreatureId } from '../creatures/creatures';

/**
 * The store screenshots (docs/11-release-store.md, section 5): `npm run store:shots` plays the
 * game in a headless browser with a stopped clock, brings it to the moment of each shot and lays a
 * caption plate and a large creature over the frame. Every number of the layout and every caption
 * lives here; nothing of it reaches the game itself.
 */

export type StorePlatform = 'ios' | 'android';
export type StoreLang = 'en' | 'ru';

export const STORE_PLATFORMS: readonly StorePlatform[] = ['ios', 'android'];
export const STORE_LANGS: readonly StoreLang[] = ['en', 'ru'];

export interface StoreDevice {
  /** The browser window in CSS pixels; times `density` it is the size of the shot. */
  cssWidth: number;
  cssHeight: number;
  density: number;
  /** Safe-area insets of the phone (`?safe=top,bottom`), CSS pixels. */
  safeTop: number;
  safeBottom: number;
  userAgent: string;
  /** Folder of the platform's shots inside the output folder. */
  folder: string;
  /** Height of the caption plate, a share of the shot width (the top of its waves). */
  plateHeight: number;
}

/**
 * iPhone 6.3" (1206 x 2622, the iPhone 16 Pro screen: the size of the App Store Connect block
 * "iPhone with Dynamic Island (medium display)", which it accepts; 1320 x 2868 was rejected) and an Android phone of 9:16 (1080 x 1920, the size Google Play asks for).
 * The two are separate layouts of the game, not one picture squeezed.
 */
export const STORE_DEVICES: Readonly<Record<StorePlatform, StoreDevice>> = {
  ios: {
    cssWidth: 402,
    cssHeight: 874,
    density: 3,
    safeTop: 62,
    safeBottom: 34,
    folder: 'ios-6.3',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    plateHeight: 0.33,
  },
  android: {
    cssWidth: 360,
    cssHeight: 640,
    density: 3,
    // No inset: the game needs 1920 logical pixels of height under the inset, and a 9:16 screen
    // with one would get bars at the sides (a 9:16 phone has no cutout).
    safeTop: 0,
    safeBottom: 0,
    folder: 'android',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    plateHeight: 0.3,
  },
};

/** Size of a shot of `platform` in pixels. */
export function storeShotSize(platform: StorePlatform): { width: number; height: number } {
  const d = STORE_DEVICES[platform];
  return { width: d.cssWidth * d.density, height: d.cssHeight * d.density };
}

/** The game clock of every shot is stopped at this local time and moves only frame by frame. */
export const STORE_CLOCK = {
  start: '2026-11-20T12:00:00',
  /** One game frame, ms. */
  frameMs: 16,
  /** Seed of `Math.random` (the menus and decorations use it; the runs have their own seeds). */
  randomSeed: 12345,
  /** A shot whose moment has not come after this much game time fails. */
  maxGameMs: 90_000,
  /** How long the face of a big creature keeps its expression (longer than the picture takes). */
  artFaceMs: 60_000,
} as const;

/** The save every shot starts from: a player some weeks in, with nothing personal in it. */
export const STORE_SAVE = {
  installId: 'store-shots',
  coins: 4280,
  berries: 135,
  bakerLevel: 24,
  creatures: {
    honey: 5,
    puff: 4,
    jelly: 5,
    caramel: 4,
    frosty: 3,
    brownie: 3,
    sprinkle: 5,
    ghost: 2,
    twins: 2,
    rainbow: 5,
  } as Readonly<Partial<Record<CreatureId, number>>>,
  team: ['rainbow', 'honey', 'jelly'] as readonly [CreatureId, CreatureId, CreatureId],
  records: { classicHeight: 148, classicScore: 21_450, bestCombo: 23 },
  stats: { runs: 64, totalLayers: 4210, perfects: 912, adsWatched: 9 },
  streak: { count: 6, best: 9 },
  daily: { attemptsUsed: 1, best: 37 },
  /** Finished interstitial-free sessions, so no first-session rule changes a screen. */
  sessions: 30,
} as const;

/** How the in-game director drops the layers before the moment of a shot. */
export type StoreDriver =
  /** Every layer lands in the middle of the tower, `drops` of them. */
  | { kind: 'perfect'; drops: number }
  /** Every layer lands `share` of its width to the right, `drops` of them: a tower that leans and wobbles. */
  | { kind: 'offset'; share: number; drops: number };

/** The moment the frame is taken, after the driver is done. */
export type StoreMoment =
  /** At least `afterMs` after the driver is done, the flying layer is `share` of its width right of the top of the tower, in the open (no cloud or nebula over it or coming). */
  | { kind: 'flying'; share: number; afterMs: number }
  /** The wobble is at least `atLeast` (of `BALANCE.wobble.max`), and the top of the sway is reached. */
  | { kind: 'wobble'; atLeast: number }
  /** `afterMs` after the ability of `creature` went off. */
  | { kind: 'ability'; creature: CreatureId; afterMs: number }
  /** `ms` after the last layer of the driver has landed. */
  | { kind: 'landed'; ms: number }
  /** `waitMs` after the driver is done a flash of lightning comes (the storm weather); the frame is `afterMs` after it. */
  | { kind: 'lightning'; waitMs: number; afterMs: number };

export type StoreScreen = 'collection' | 'daily' | 'shop';

export type StoreStage =
  | {
      kind: 'run';
      /** Query of the game page: seed, team, start height, weather (the debug parameters of docs/08, section 9). */
      query: string;
      driver: StoreDriver;
      moment: StoreMoment;
      /** The HUD is hidden (only the cover, which shows the world behind the title). */
      hideHud?: boolean;
    }
  | { kind: 'screen'; screen: StoreScreen; settleMs: number };

/** A point and size on the shot: `x`, `width` are shares of its width, `y` a share of its height. */
export interface StorePlace {
  x: number;
  y: number;
  width: number;
  /** Turn in degrees, clockwise. */
  angle?: number;
}

/** A face of the big creature (`Reaction` of `objects/creatures/face-state.ts`). */
export type StoreFace = 'joy' | 'wink' | 'horror' | 'panic' | 'gape' | 'none';

export type StoreOverlay =
  | {
      kind: 'creature';
      creature: CreatureId;
      level: number;
      /** The grown look of mastery (a crown, a bow...). */
      grown: boolean;
      face: StoreFace;
      /** A layout without a place has no such creature. */
      place: Readonly<Partial<Record<StorePlatform, StorePlace>>>;
    }
  /** The glossy render of the hero the owner gave (`tippy-icon-hero-transparent.png`): the cover and the feature graphic only. */
  | { kind: 'hero'; place: Readonly<Record<StorePlatform, StorePlace>> };

export type StoreShotId =
  'cover' | 'tap' | 'wobble' | 'powers' | 'collect' | 'weather' | 'space' | 'daily';

export interface StoreShot {
  id: StoreShotId;
  /** File name without the extension; the number keeps the order of the store page. */
  file: string;
  caption: Readonly<Record<StoreLang, string>>;
  stage: StoreStage;
  overlays: readonly StoreOverlay[];
}

/** The big creatures that peek over the plate (the plate hides their bottom). */
export const PEEK = {
  /** Width of a creature, a share of the shot width. */
  width: 0.46,
  /** Its centre from the side, a share of the shot width. */
  inset: 0.19,
  /** Its centre above the top of the plate, a share of the shot width. */
  rise: 0.11,
  /** Turn away from the middle, degrees. */
  angle: 9,
  /** The one in the middle (the cover) is this much larger. */
  centreScale: 1.15,
} as const;

/** Top of the plate (its wave line), a share of the shot height. */
export function plateTopShare(platform: StorePlatform): number {
  const d = STORE_DEVICES[platform];
  return 1 - (d.plateHeight * d.cssWidth) / d.cssHeight;
}

type PeekSide = 'left' | 'right' | 'centre';

/**
 * A grown creature of level 5 peeking over a corner or the middle of the plate; `rise` overrides
 * `PEEK.rise`, `platforms` names the layouts that have it.
 */
function peek(
  side: PeekSide,
  creature: CreatureId,
  face: StoreFace,
  rise: number = PEEK.rise,
  platforms: readonly StorePlatform[] = STORE_PLATFORMS,
): StoreOverlay {
  const centre = side === 'centre';
  const place = (platform: StorePlatform): StorePlace => {
    const d = STORE_DEVICES[platform];

    const x = { left: PEEK.inset, right: 1 - PEEK.inset, centre: 0.5 }[side];
    const angle = { left: -PEEK.angle, right: PEEK.angle, centre: 0 }[side];
    return {
      x,
      y: plateTopShare(platform) - (rise * d.cssWidth) / d.cssHeight,
      width: PEEK.width * (centre ? PEEK.centreScale : 1),
      angle,
    };
  };
  return {
    kind: 'creature',
    creature,
    level: 5,
    grown: true,
    face,
    place: Object.fromEntries(platforms.map((p) => [p, place(p)])),
  };
}

/** How high the creature of the collection stands over the plate. */
const COLLECT_RISE = 0.05;

/** How high the creatures of the cover stand over the plate (`PEEK.rise`). */
const COVER_SIDE_RISE = 0.2;
const COVER_CENTRE_RISE = 0.08;

/** The eight shots, in the order of the store page. */
export const STORE_SHOTS: readonly StoreShot[] = [
  {
    id: 'cover',
    file: '01-cover',
    caption: { en: 'TIPPY TREATS', ru: 'TIPPY TREATS' },
    stage: {
      kind: 'run',
      query: 'tutorial=0&team=rainbow,sprinkle,jelly&level=5&start=44&seed=4401&weather=sunset',
      driver: { kind: 'perfect', drops: 2 },
      // Right after a landing, before the next layer flies in behind the hero.
      moment: { kind: 'landed', ms: 40 },
      hideHud: true,
    },
    overlays: [
      {
        kind: 'hero',
        place: {
          ios: { x: 0.5, y: 0.3, width: 1.04 },
          android: { x: 0.5, y: 0.3, width: 0.92 },
        },
      },
      // Two higher at the sides behind, one lower in the middle in front: a little crowd.
      peek('left', 'jelly', 'joy', COVER_SIDE_RISE),
      peek('right', 'honey', 'wink', COVER_SIDE_RISE),
      peek('centre', 'rainbow', 'joy', COVER_CENTRE_RISE),
    ],
  },
  {
    id: 'tap',
    file: '02-tap',
    caption: { en: 'TAP TO STACK!', ru: 'КОСНИСЬ И РОНЯЙ!' },
    stage: {
      kind: 'run',
      query: 'tutorial=1&start=5&seed=7',
      driver: { kind: 'perfect', drops: 0 },
      moment: { kind: 'flying', share: 0.12, afterMs: 2400 },
    },
    overlays: [peek('right', 'honey', 'joy')],
  },
  {
    id: 'wobble',
    file: '03-wobble',
    caption: { en: "DON'T LET IT TIP!", ru: 'НЕ ДАЙ ЕЙ УПАСТЬ!' },
    stage: {
      kind: 'run',
      query: 'tutorial=0&team=honey,puff,sprinkle&level=3&start=10&seed=21',
      driver: { kind: 'offset', share: 0.13, drops: 6 },
      moment: { kind: 'wobble', atLeast: 85 },
    },
    overlays: [peek('left', 'jelly', 'horror')],
  },
  {
    id: 'powers',
    file: '04-powers',
    caption: { en: '12 UNIQUE POWERS!', ru: '12 СПОСОБНОСТЕЙ!' },
    stage: {
      kind: 'run',
      query: 'tutorial=0&team=rainbow,caramel,jelly&level=5&start=20&seed=11',
      // Off the middle by more than the perfect tolerance (20 px): on a perfect landing the game
      // writes "Boosted!" and "Perfect!" in one place over each other. The frame is taken when the
      // arc has reached the next layer and paints it in rainbow colours.
      driver: { kind: 'offset', share: 0.05, drops: 99 },
      moment: { kind: 'ability', creature: 'rainbow', afterMs: 550 },
    },
    overlays: [peek('left', 'rainbow', 'wink')],
  },
  {
    id: 'collect',
    file: '05-collect',
    caption: { en: 'COLLECT & LEVEL UP!', ru: 'СОБИРАЙ И ПРОКАЧИВАЙ!' },
    stage: { kind: 'screen', screen: 'collection', settleMs: 1500 },
    // Low: on the shorter Android screen the stars of the third row are right above the plate.
    overlays: [peek('right', 'sprinkle', 'joy', COLLECT_RISE)],
  },
  {
    id: 'weather',
    file: '06-weather',
    caption: { en: 'RAIN & THUNDER!', ru: 'ДОЖДЬ И ГРОЗА!' },
    stage: {
      kind: 'run',
      // The Roof: the storm sky is open there (in the Kitchen it shows only through the small window).
      query: 'tutorial=0&team=honey,frosty,brownie&level=3&start=44&seed=41&weather=storm',
      driver: { kind: 'perfect', drops: 1 },
      moment: { kind: 'lightning', waitMs: 1200, afterMs: 90 },
    },
    overlays: [peek('left', 'frosty', 'gape')],
  },
  {
    id: 'space',
    file: '07-space',
    caption: { en: 'KITCHEN TO SPACE!', ru: 'ОТ КУХНИ ДО КОСМОСА!' },
    stage: {
      kind: 'run',
      query: 'tutorial=0&team=rainbow,ghost,lemon&level=5&start=104&seed=104',
      driver: { kind: 'perfect', drops: 3 },
      moment: { kind: 'flying', share: 0.2, afterMs: 600 },
    },
    overlays: [peek('right', 'ghost', 'joy')],
  },
  {
    id: 'daily',
    file: '08-daily',
    caption: { en: 'NEW TOWER DAILY!', ru: 'НОВАЯ БАШНЯ КАЖДЫЙ ДЕНЬ!' },
    stage: { kind: 'screen', screen: 'daily', settleMs: 1500 },
    // No big creature: the attempts row and the play button stand right above the plate, and a
    // creature low enough to leave them free would show no face. The team cards show three.
    overlays: [],
  },
];

/** The shop as it is, without a caption: the review screenshot of the in-app purchases (App Store Connect). */
export const STORE_IAP_SHOT = {
  file: 'shop',
  platform: 'ios' as StorePlatform,
  lang: 'en' as StoreLang,
  stage: { kind: 'screen', screen: 'shop', settleMs: 1500 } as StoreStage,
} as const;

/** The caption plate at the bottom of a shot; lengths are shares of the shot width. */
export const STORE_PLATE = {
  /** `PALETTE.accent`. */
  color: '#ff5c8a',
  /** A lighter rim along the waves. */
  rimColor: '#ff8fb0',
  rimWidth: 0.012,
  /** A soft shadow over the frame above the waves. */
  shadowColor: 'rgba(59, 42, 74, 0.28)',
  shadowBlur: 0.03,
  waveAmplitude: 0.02,
  /** Length of one wave. */
  waveLength: 0.5,
  /** Where the first crest is, a share of a wave. */
  wavePhase: 0.25,
} as const;

/** The caption on the plate: Nunito Black, slanted, white with a dark outline. */
export const STORE_CAPTION = {
  /** `PALETTE.textLight` and `PALETTE.textDark`. */
  fill: '#ffffff',
  outline: '#3b2a4a',
  /** Outline width, a share of the font size (drawn outside the letters). */
  outlineWidth: 0.16,
  /** Dark pink drop under the letters, a share of the font size. */
  dropColor: '#c93a68',
  drop: 0.07,
  weight: 900,
  /** The slant of the letters: x moves by this share of y (about 11 degrees). */
  slant: 0.2,
  /** Font size of a one-line caption at most, and the smallest allowed, shares of the shot width. */
  maxSize: 0.105,
  minSize: 0.06,
  /** The text fits this share of the shot width. */
  maxWidth: 0.84,
  /** At most this many lines; a line breaks only between words. */
  maxLines: 2,
  lineHeight: 1.0,
  /** A word of this many letters or fewer goes to the next line with the word after it (no hanging `И`, `ДО`, `&`). */
  glueUpTo: 2,
  /** One more line must make the text this much larger to be worth it (one line at 0.85 of the size of two still wins). */
  moreLinesCost: 0.85,
  /** Room kept free inside the plate: below the lowest point of the waves and above the bottom edge, a share of the shot width. */
  padding: 0.035,
} as const;

/**
 * The feature graphic of Google Play: 1024 x 500, no alpha. Google crops the edges and may put a
 * play button in the middle: the tower and the hero stand left of it, the title right of it.
 */
export const STORE_FEATURE = {
  width: 1024,
  height: 500,
  /**
   * The background: a frame of its own (the bright Showcase street, HUD hidden), its whole width,
   * a band centred at `centreY` of the frame height (above the tower of the frame).
   */
  background: {
    platform: 'ios' as StorePlatform,
    stage: {
      kind: 'run',
      query: 'tutorial=0&team=rainbow,sprinkle,jelly&level=5&start=20&seed=2001&weather=clear',
      driver: { kind: 'perfect', drops: 7 },
      moment: { kind: 'landed', ms: 40 },
      hideHud: true,
    } as StoreStage,
    centreY: 0.25,
  },
  /**
   * A short tower of creatures on the left, as the game draws them (bottom first): centre `x`,
   * the bottom of the lowest at `bottom`, each `width` wide (shares of the width) and `step` above
   * the one below (a share of the height), every other one shifted by `shift` (of the width).
   */
  tower: {
    creatures: [
      { creature: 'rainbow', level: 5, grown: false, face: 'joy' },
      { creature: 'puff', level: 5, grown: false, face: 'wink' },
    ] as ReadonlyArray<{ creature: CreatureId; level: number; grown: boolean; face: StoreFace }>,
    x: 0.25,
    bottom: 0.95,
    width: 0.25,
    step: 0.2,
    shift: 0.015,
  },
  /** The hero standing on the tower: its centre is `rise` (of the height) above the top creature's centre; height a share of the height. */
  hero: { rise: 0.29, height: 0.56 },
  /** The title and the line under it, one block centred at `x`, `centreY` (shares); sizes are shares of the width. */
  text: { x: 0.77, centreY: 0.5, maxWidth: 0.36, gap: 0.02 },
  title: { text: 'TIPPY TREATS', maxSize: 0.12, minSize: 0.06, maxLines: 2 },
  subtitle: {
    text: { en: 'Stack & collect cute desserts', ru: 'Башня из живых десертов' } as Readonly<
      Record<StoreLang, string>
    >,
    maxSize: 0.045,
    minSize: 0.03,
    maxLines: 2,
  },
} as const;

/** The Google Play icon: the iOS icon scaled down. */
export const STORE_ICON = { size: 512, maxBytes: 1024 * 1024 } as const;
