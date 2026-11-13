import type { CreatureId } from './creatures';

/** Mouth shapes of a face (the pictures are `assets/svg/face_mouth_*.svg`). */
export type MouthKind = 'smile' | 'open' | 'o' | 'flat' | 'scared' | 'yum';

/**
 * One brow. `angleDeg` turns the inner end up (positive: worried, "домиком") or down
 * (negative: frowning); `offsetY` moves it from the standard brow line (negative: higher).
 */
export interface BrowPose {
  angleDeg: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

/** Two small faces side by side (twins). */
export interface PairLayout {
  /** Distance of each face centre from the layer centre. */
  spread: number;
  /** Size of each face relative to a single face. */
  scale: number;
  /** Pupils of the left face look right and the other way round, by this many pixels. */
  gaze: number;
  /** Below this layer width the pair shrinks; below `eyesOnlyWidth` only eyes and brows stay. */
  fullWidth: number;
  eyesOnlyWidth: number;
}

/** What a creature's face does at rest (docs/06, section 3, "Существа"). */
export interface FaceRecipe {
  browLeft: BrowPose;
  browRight: BrowPose;
  /** The calm mouth. */
  mouth: MouthKind;
  /** Share of each eye (0..1) covered from above at rest: sleepy and squinting eyes. */
  lidLeft: number;
  lidRight: number;
  /** Blush size; 0 hides it. `cheekSpread` widens the distance between the cheeks. */
  cheekScale: number;
  cheekSpread: number;
  /** Shifts the whole face (negative: up). */
  offsetY: number;
  /** Light brows for a dark body. */
  lightBrows: boolean;
  /** Which colour of the creature's palette the eyelids take (the body, unless it clashes with the art). */
  lidTint: 'body' | 'glaze' | 'accent' | 'detail' | 'sponge';
  /** `null`: one face in the middle. */
  pair: PairLayout | null;
}

function brow(angleDeg: number, offsetY = 0, scaleX = 1, scaleY = 1): BrowPose {
  return { angleDeg, offsetY, scaleX, scaleY };
}

const FACE_DEFAULTS = {
  lidLeft: 0,
  lidRight: 0,
  cheekScale: 1,
  cheekSpread: 1,
  offsetY: 0,
  lightBrows: false,
  lidTint: 'body',
  pair: null,
} as const;

/**
 * Per-creature drawing of the body. `kind` is the creature id, `topPad` is how far the detail
 * above the top edge reaches (the picture grows upward, the layer body stays as it is).
 * `alpha` below 1 makes the whole layer slightly see-through.
 */
export type ArtRecipe =
  | { kind: 'honey'; topPad: number; stripes: number; dripCount: number; dripLength: number }
  | {
      kind: 'puff';
      topPad: number;
      puffsNarrow: number;
      puffsWide: number;
      wideFrom: number;
      grooves: number;
      puffRadius: number;
    }
  | {
      kind: 'jelly';
      topPad: number;
      alpha: number;
      bubbles: number;
      scallopRadius: number;
      scallopStep: number;
    }
  | { kind: 'caramel'; topPad: number; capDepth: number; dripCount: number; dripLength: number }
  | { kind: 'frosty'; topPad: number; waferShare: number; holeStep: number; crystals: number }
  | { kind: 'brownie'; topPad: number; cracks: number; nuts: number }
  | {
      kind: 'sprinkle';
      topPad: number;
      sprinkles: number;
      sprinkleColors: readonly string[];
      scallopRadius: number;
    }
  | { kind: 'crumb'; topPad: number; chips: number; bumps: number; bumpRadius: number }
  | {
      kind: 'ghost';
      topPad: number;
      alpha: number;
      peakHeight: number;
      peakWidth: number;
      swirlStep: number;
    }
  | {
      kind: 'twins';
      topPad: number;
      /** Share of the body height above the cream strip. */
      topShare: number;
      creamShare: number;
      /** The "feet" of the shells: radius of the bumps along the edge next to the cream. */
      feetRadius: number;
      /** Distance between feet as a multiple of their radius, and how much darker they are. */
      feetStep: number;
      feetShade: number;
    }
  | { kind: 'lemon'; topPad: number; creamShare: number; sliceRadius: number; ribStep: number }
  | {
      kind: 'rainbow';
      topPad: number;
      bands: readonly string[];
      creamShare: number;
      crown: number;
    };

export interface CreatureLook {
  art: ArtRecipe;
  face: FaceRecipe;
}

export const CREATURE_LOOKS: Readonly<Record<CreatureId, CreatureLook>> = {
  honey: {
    art: { kind: 'honey', topPad: 0, stripes: 4, dripCount: 5, dripLength: 34 },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(6, 4),
      browRight: brow(6, 4),
      mouth: 'smile',
      lidLeft: 0.45,
      lidRight: 0.45,
    },
  },
  puff: {
    art: {
      kind: 'puff',
      topPad: 38,
      puffsNarrow: 3,
      puffsWide: 4,
      wideFrom: 300,
      grooves: 7,
      puffRadius: 36,
    },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(0, -10),
      browRight: brow(0, -10),
      mouth: 'open',
      cheekScale: 1.5,
    },
  },
  jelly: {
    art: {
      kind: 'jelly',
      topPad: 12,
      alpha: 0.86,
      bubbles: 8,
      scallopRadius: 15,
      scallopStep: 34,
    },
    face: { ...FACE_DEFAULTS, browLeft: brow(0), browRight: brow(0), mouth: 'flat' },
  },
  caramel: {
    art: { kind: 'caramel', topPad: 0, capDepth: 0.5, dripCount: 4, dripLength: 30 },
    face: { ...FACE_DEFAULTS, browLeft: brow(-6), browRight: brow(14, -12), mouth: 'yum' },
  },
  frosty: {
    art: { kind: 'frosty', topPad: 36, waferShare: 0.16, holeStep: 24, crystals: 2 },
    face: { ...FACE_DEFAULTS, browLeft: brow(4), browRight: brow(4), mouth: 'smile' },
  },
  brownie: {
    art: { kind: 'brownie', topPad: 0, cracks: 5, nuts: 7 },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(-26, 2, 1.3, 1.6),
      browRight: brow(-26, 2, 1.3, 1.6),
      mouth: 'flat',
      lightBrows: true,
    },
  },
  sprinkle: {
    art: {
      kind: 'sprinkle',
      topPad: 0,
      sprinkles: 26,
      sprinkleColors: ['#7fd1ff', '#fff27a', '#7dffb0', '#ffffff', '#b78cff'],
      scallopRadius: 14,
    },
    face: { ...FACE_DEFAULTS, browLeft: brow(0, -12), browRight: brow(0, -12), mouth: 'open' },
  },
  crumb: {
    art: { kind: 'crumb', topPad: 20, chips: 11, bumps: 6, bumpRadius: 17 },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(-18, 0, 1.1, 1.2),
      browRight: brow(-18, 0, 1.1, 1.2),
      mouth: 'yum',
      cheekScale: 1.9,
      cheekSpread: 1.15,
    },
  },
  ghost: {
    art: { kind: 'ghost', topPad: 58, alpha: 0.9, peakHeight: 52, peakWidth: 46, swirlStep: 44 },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(24, -4),
      browRight: brow(24, -4),
      mouth: 'o',
      cheekScale: 1.3,
    },
  },
  twins: {
    art: {
      kind: 'twins',
      topPad: 0,
      topShare: 0.44,
      creamShare: 0.12,
      feetRadius: 5,
      feetStep: 1.5,
      feetShade: -0.14,
    },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(-22, 0, 0.9),
      browRight: brow(-22, 0, 0.9),
      mouth: 'flat',
      cheekScale: 0,
      offsetY: -26,
      pair: { spread: 100, scale: 0.52, gaze: 4, fullWidth: 320, eyesOnlyWidth: 150 },
    },
  },
  lemon: {
    art: { kind: 'lemon', topPad: 36, creamShare: 0.74, sliceRadius: 28, ribStep: 16 },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(10, -12),
      browRight: brow(-22, 4),
      mouth: 'smile',
      lidRight: 0.35,
      offsetY: -6,
    },
  },
  rainbow: {
    art: {
      kind: 'rainbow',
      topPad: 30,
      bands: ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#b197fc'],
      creamShare: 0.2,
      crown: 3,
    },
    face: {
      ...FACE_DEFAULTS,
      browLeft: brow(6, -8),
      browRight: brow(6, -8),
      mouth: 'smile',
      lidLeft: 0.45,
      lidRight: 0.45,
      // The body is pink and would show as blobs over the stripes: the lids take the cream.
      lidTint: 'glaze',
    },
  },
};

/** The face recipe of a creature layer. */
export function faceRecipe(id: CreatureId): FaceRecipe {
  return CREATURE_LOOKS[id].face;
}

/** The body drawing recipe of a creature layer. */
export function artRecipe(id: CreatureId): ArtRecipe {
  return CREATURE_LOOKS[id].art;
}
