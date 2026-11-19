import type { Rarity } from './rarity';

/** The 12 creatures of version 1.0 (docs/03-creatures.md). An effect id is the id of its creature. */
export const CREATURE_IDS = [
  'honey',
  'puff',
  'jelly',
  'caramel',
  'frosty',
  'brownie',
  'sprinkle',
  'crumb',
  'ghost',
  'twins',
  'lemon',
  'rainbow',
] as const;

export type CreatureId = (typeof CREATURE_IDS)[number];

export function isCreatureId(value: string): value is CreatureId {
  return (CREATURE_IDS as readonly string[]).includes(value);
}

export const MAX_CREATURE_LEVEL = 5;

/** One value per creature level, level 1 first. */
export type LevelValues = readonly [number, number, number, number, number];

/**
 * Per-ability numbers. `kind` equals the creature id. Lengths ("N layers") count the layers
 * placed after the creature; a perfect landing of the creature layer boosts the ability
 * (see BALANCE.team.perfectBoost and each ability module for what exactly grows).
 */
export type AbilityDef =
  | { kind: 'honey'; layers: number; tolerance: LevelValues }
  | { kind: 'puff'; widen: LevelValues }
  | { kind: 'jelly'; relief: LevelValues; springLayers: number; springPercent: LevelValues }
  | { kind: 'caramel'; layers: LevelValues; coinMultAdd: number }
  | { kind: 'frosty'; layers: number; slowPercent: LevelValues }
  | { kind: 'brownie'; layers: LevelValues }
  | { kind: 'sprinkle'; layers: number; scoreMult: LevelValues }
  | { kind: 'crumb'; layers: number; pixelsPerCoin: LevelValues }
  /** `centreMarkFrom`: from this level the guides also mark the centre of the perfect spot (display only). */
  | { kind: 'ghost'; layers: LevelValues; centreMarkFrom: number }
  | { kind: 'twins'; bonusScore: LevelValues; bonusHeight: number }
  | {
      kind: 'lemon';
      layers: number;
      speedMult: number;
      scoreMult: LevelValues;
      perfectCoinAdd: number;
    }
  /**
   * `protectedScore`: flat score for every layer that lands under the protection (0 = none);
   * `ownLayerFrom`: from this level the rainbow layer itself is not cut either.
   */
  | {
      kind: 'rainbow';
      layers: LevelValues;
      boostExtraLayers: number;
      protectedScore: LevelValues;
      ownLayerFrom: number;
    };

export type UnlockDef =
  | { kind: 'tutorial' }
  | { kind: 'bakerLevel'; level: number }
  /** A shop entry holds exactly one price; alternative prices are separate entries. */
  | { kind: 'shop'; coins?: number; berries?: number; minBakerLevel?: number }
  | { kind: 'streak'; day: number }
  | { kind: 'record'; mode: 'classic'; height: number }
  | { kind: 'iap'; product: 'starter_pack' };

/** Colours of a creature layer, as `#rrggbb`; every design reads the roles it needs (`creature-looks.ts`). */
export interface CreaturePalette {
  /** Main tone of the body. */
  body: string;
  /** Glaze, top or cap. */
  glaze: string;
  /** Pattern colour: stripes, grooves, chips, crystals. */
  accent: string;
  /** Second pattern colour: shading, nuts, shell skirts, lemon rind. */
  detail: string;
  /** The cut side of the layer (the sponge) before it is lightened. */
  sponge: string;
  /** Outline of the layer and its details: a dark warm tone of the creature's own colour, never grey. */
  outline: string;
  /** Overrides the body shadow tone (default: the body mixed with the outline); for a near-white body. */
  shadow?: string;
}

export interface CreatureDef {
  id: CreatureId;
  /** i18n key `creature.<id>.name`. */
  nameKey: string;
  /** i18n key `creature.<id>.desc`. */
  descKey: string;
  /** i18n key `creature.<id>.trait`: the character in a few words. */
  traitKey: string;
  rarity: Rarity;
  ability: AbilityDef;
  /** Every way to get the creature; any one is enough. */
  unlock: UnlockDef[];
  palette: CreaturePalette;
}

const keys = <T extends CreatureId>(id: T) =>
  ({
    id,
    nameKey: `creature.${id}.name`,
    descKey: `creature.${id}.desc`,
    traitKey: `creature.${id}.trait`,
  }) as const;

export const CREATURES: Record<CreatureId, CreatureDef> = {
  honey: {
    ...keys('honey'),
    rarity: 'common',
    ability: { kind: 'honey', layers: 3, tolerance: [30, 34, 38, 39, 41] },
    unlock: [{ kind: 'tutorial' }],
    palette: {
      body: '#e8b04a',
      glaze: '#b86f1c',
      accent: '#fff3c4',
      detail: '#8a4e12',
      sponge: '#f6d58a',
      outline: '#96601a',
    },
  },
  puff: {
    ...keys('puff'),
    rarity: 'common',
    ability: { kind: 'puff', widen: [45, 55, 65, 70, 75] },
    unlock: [{ kind: 'bakerLevel', level: 2 }],
    palette: {
      body: '#fff0f5',
      glaze: '#ffc2d9',
      accent: '#ff8fb8',
      detail: '#ffffff',
      sponge: '#fffafc',
      outline: '#b83a6e',
    },
  },
  jelly: {
    ...keys('jelly'),
    rarity: 'common',
    ability: {
      kind: 'jelly',
      relief: [40, 50, 60, 75, 100],
      springLayers: 4,
      springPercent: [30, 35, 40, 45, 55],
    },
    unlock: [{ kind: 'shop', coins: 300 }],
    palette: {
      body: '#34b09a',
      glaze: '#1d8c7c',
      accent: '#d8fff4',
      detail: '#7fe6d2',
      sponge: '#7fe6d2',
      outline: '#14705f',
    },
  },
  caramel: {
    ...keys('caramel'),
    rarity: 'common',
    ability: { kind: 'caramel', layers: [8, 10, 12, 14, 18], coinMultAdd: 1 },
    unlock: [{ kind: 'shop', coins: 300 }],
    palette: {
      body: '#fff0c8',
      glaze: '#a8601c',
      accent: '#ffe2a8',
      detail: '#e0983e',
      sponge: '#fff7e0',
      outline: '#8a4e14',
    },
  },
  frosty: {
    ...keys('frosty'),
    rarity: 'rare',
    ability: { kind: 'frosty', layers: 3, slowPercent: [20, 24, 28, 32, 38] },
    unlock: [{ kind: 'shop', coins: 900, minBakerLevel: 4 }],
    palette: {
      body: '#f2faff',
      glaze: '#b07a40',
      accent: '#9fd8ff',
      detail: '#6e4521',
      sponge: '#ffffff',
      outline: '#6b4220',
      shadow: '#c6dcee',
    },
  },
  brownie: {
    ...keys('brownie'),
    rarity: 'rare',
    ability: { kind: 'brownie', layers: [5, 7, 9, 11, 13] },
    unlock: [{ kind: 'streak', day: 7 }],
    palette: {
      body: '#6a3e28',
      glaze: '#3e2216',
      accent: '#d9a679',
      detail: '#c68e5a',
      sponge: '#8d5a3c',
      outline: '#3a1e12',
    },
  },
  sprinkle: {
    ...keys('sprinkle'),
    rarity: 'rare',
    ability: { kind: 'sprinkle', layers: 5, scoreMult: [2, 2.25, 2.5, 2.75, 3] },
    unlock: [{ kind: 'shop', coins: 900, minBakerLevel: 6 }],
    palette: {
      body: '#f2d3a0',
      glaze: '#ff7eb6',
      accent: '#7fd1ff',
      detail: '#d6a96a',
      sponge: '#fbe6c0',
      outline: '#a8602e',
    },
  },
  crumb: {
    ...keys('crumb'),
    rarity: 'rare',
    ability: { kind: 'crumb', layers: 6, pixelsPerCoin: [24, 20, 16, 13, 10] },
    unlock: [
      { kind: 'iap', product: 'starter_pack' },
      { kind: 'shop', coins: 1200, minBakerLevel: 8 },
    ],
    palette: {
      body: '#e0ad63',
      glaze: '#a56a2c',
      accent: '#4a2c14',
      detail: '#c8903f',
      sponge: '#f0c987',
      outline: '#8e5a20',
    },
  },
  ghost: {
    ...keys('ghost'),
    rarity: 'epic',
    ability: { kind: 'ghost', layers: [3, 3, 3, 4, 4], centreMarkFrom: 2 },
    unlock: [{ kind: 'shop', coins: 2500, minBakerLevel: 10 }],
    palette: {
      body: '#f6f3ff',
      glaze: '#cfc6f5',
      accent: '#9b8cdc',
      detail: '#ffffff',
      sponge: '#ffffff',
      outline: '#7662b8',
    },
  },
  twins: {
    ...keys('twins'),
    rarity: 'epic',
    ability: { kind: 'twins', bonusScore: [50, 80, 120, 170, 250], bonusHeight: 1 },
    unlock: [
      { kind: 'record', mode: 'classic', height: 75 },
      { kind: 'shop', coins: 2500, minBakerLevel: 14 },
    ],
    palette: {
      body: '#a58be8',
      glaze: '#8a6fe0',
      accent: '#fff2c9',
      detail: '#d9c9ff',
      sponge: '#cdbcf7',
      outline: '#5c43b0',
    },
  },
  lemon: {
    ...keys('lemon'),
    rarity: 'epic',
    ability: {
      kind: 'lemon',
      layers: 4,
      speedMult: 1.2,
      scoreMult: [3, 3.5, 4, 4.5, 5],
      perfectCoinAdd: 1,
    },
    unlock: [
      { kind: 'shop', coins: 2500, minBakerLevel: 12 },
      { kind: 'shop', berries: 250, minBakerLevel: 12 },
    ],
    palette: {
      body: '#e0b66a',
      glaze: '#ffe45e',
      accent: '#fffbe0',
      detail: '#c99a45',
      sponge: '#f3d99a',
      outline: '#a8761a',
    },
  },
  rainbow: {
    ...keys('rainbow'),
    rarity: 'legendary',
    ability: {
      kind: 'rainbow',
      layers: [1, 1, 1, 2, 2],
      boostExtraLayers: 1,
      protectedScore: [0, 50, 50, 50, 50],
      ownLayerFrom: 3,
    },
    unlock: [
      { kind: 'bakerLevel', level: 20 },
      { kind: 'shop', berries: 600, minBakerLevel: 5 },
    ],
    palette: {
      body: '#ffe9c9',
      glaze: '#fffdf7',
      accent: '#ffe76b',
      detail: '#ffffff',
      sponge: '#fff0f8',
      // The tone of the arc outline and of the plain layers: warm dark, not purple.
      outline: '#9e6930',
    },
  },
};

/** Ability numbers of one creature, narrowed by its id. */
export function abilityDef<K extends CreatureId>(id: K): Extract<AbilityDef, { kind: K }> {
  return CREATURES[id].ability as Extract<AbilityDef, { kind: K }>;
}

/** Clamps a level to 1..5 and rounds it down. */
export function clampLevel(level: number): number {
  return Math.min(MAX_CREATURE_LEVEL, Math.max(1, Math.floor(level)));
}

/** The one place that picks a per-level value. */
export function levelValue(values: LevelValues, level: number): number {
  return values[clampLevel(level) - 1] ?? values[0];
}
