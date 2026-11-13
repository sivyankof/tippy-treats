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
  | { kind: 'ghost'; layers: LevelValues }
  | { kind: 'twins'; bonusScore: LevelValues; bonusHeight: number }
  | {
      kind: 'lemon';
      layers: number;
      speedMult: number;
      scoreMult: LevelValues;
      perfectCoinAdd: number;
    }
  | { kind: 'rainbow'; layers: LevelValues; boostExtraLayers: number };

export type UnlockDef =
  | { kind: 'tutorial' }
  | { kind: 'bakerLevel'; level: number }
  /** A shop entry holds exactly one price; alternative prices are separate entries. */
  | { kind: 'shop'; coins?: number; berries?: number; minBakerLevel?: number }
  | { kind: 'streak'; day: number }
  | { kind: 'record'; mode: 'classic'; height: number }
  | { kind: 'iap'; product: 'starter_pack' };

export interface CreaturePalette {
  body: string;
  glaze: string;
  accent: string;
}

export interface CreatureDef {
  id: CreatureId;
  /** i18n key `creature.<id>.name`. */
  nameKey: string;
  /** i18n key `creature.<id>.desc`. */
  descKey: string;
  rarity: Rarity;
  ability: AbilityDef;
  /** Every way to get the creature; any one is enough. */
  unlock: UnlockDef[];
  palette: CreaturePalette;
}

const keys = <T extends CreatureId>(id: T) =>
  ({ id, nameKey: `creature.${id}.name`, descKey: `creature.${id}.desc` }) as const;

export const CREATURES: Record<CreatureId, CreatureDef> = {
  honey: {
    ...keys('honey'),
    rarity: 'common',
    ability: { kind: 'honey', layers: 3, tolerance: [30, 34, 38, 42, 48] },
    unlock: [{ kind: 'tutorial' }],
    palette: { body: '#e8b04a', glaze: '#c9822b', accent: '#fff3c4' },
  },
  puff: {
    ...keys('puff'),
    rarity: 'common',
    ability: { kind: 'puff', widen: [45, 55, 65, 75, 90] },
    unlock: [{ kind: 'bakerLevel', level: 2 }],
    palette: { body: '#fff0f5', glaze: '#ffc2d9', accent: '#ff8fb8' },
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
    palette: { body: '#7fd6c2', glaze: '#4fb39e', accent: '#d8fff4' },
  },
  caramel: {
    ...keys('caramel'),
    rarity: 'common',
    ability: { kind: 'caramel', layers: [8, 10, 12, 14, 18], coinMultAdd: 1 },
    unlock: [{ kind: 'shop', coins: 300 }],
    palette: { body: '#e3a15a', glaze: '#b8702a', accent: '#ffe2a8' },
  },
  frosty: {
    ...keys('frosty'),
    rarity: 'rare',
    ability: { kind: 'frosty', layers: 3, slowPercent: [20, 24, 28, 32, 38] },
    unlock: [{ kind: 'shop', coins: 900, minBakerLevel: 4 }],
    palette: { body: '#bfe6ff', glaze: '#7cc4f0', accent: '#ffffff' },
  },
  brownie: {
    ...keys('brownie'),
    rarity: 'rare',
    ability: { kind: 'brownie', layers: [5, 7, 9, 11, 13] },
    unlock: [{ kind: 'streak', day: 7 }],
    palette: { body: '#7a4a32', glaze: '#4e2c1c', accent: '#d9a679' },
  },
  sprinkle: {
    ...keys('sprinkle'),
    rarity: 'rare',
    ability: { kind: 'sprinkle', layers: 5, scoreMult: [2, 2.25, 2.5, 2.75, 3] },
    unlock: [{ kind: 'shop', coins: 900, minBakerLevel: 6 }],
    palette: { body: '#f2b987', glaze: '#ff7eb6', accent: '#7fd1ff' },
  },
  crumb: {
    ...keys('crumb'),
    rarity: 'rare',
    ability: { kind: 'crumb', layers: 6, pixelsPerCoin: [24, 20, 16, 13, 10] },
    unlock: [
      { kind: 'iap', product: 'starter_pack' },
      { kind: 'shop', coins: 1200, minBakerLevel: 8 },
    ],
    palette: { body: '#d9a45f', glaze: '#a56a2c', accent: '#5b3a1e' },
  },
  ghost: {
    ...keys('ghost'),
    rarity: 'epic',
    ability: { kind: 'ghost', layers: [3, 3, 4, 5, 6] },
    unlock: [{ kind: 'shop', coins: 2500, minBakerLevel: 10 }],
    palette: { body: '#f4f1ff', glaze: '#cfc6f5', accent: '#9b8cdc' },
  },
  twins: {
    ...keys('twins'),
    rarity: 'epic',
    ability: { kind: 'twins', bonusScore: [50, 80, 120, 170, 250], bonusHeight: 1 },
    unlock: [{ kind: 'record', mode: 'classic', height: 75 }],
    palette: { body: '#b9a3f5', glaze: '#8a6fe0', accent: '#fff2c9' },
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
    palette: { body: '#ffe45e', glaze: '#f2c200', accent: '#fffbe0' },
  },
  rainbow: {
    ...keys('rainbow'),
    rarity: 'legendary',
    ability: { kind: 'rainbow', layers: [1, 1, 2, 2, 3], boostExtraLayers: 1 },
    unlock: [
      { kind: 'bakerLevel', level: 20 },
      { kind: 'shop', berries: 600, minBakerLevel: 5 },
    ],
    palette: { body: '#ff9ecf', glaze: '#8fd3ff', accent: '#ffe76b' },
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
