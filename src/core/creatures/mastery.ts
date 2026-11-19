import {
  abilityDef,
  clampLevel,
  levelValue,
  MAX_CREATURE_LEVEL,
  type CreatureId,
} from '../../data/creatures/creatures';
import { MASTERY, type PerkId } from '../../data/creatures/mastery';
import { PERCENT } from '../../util/math';
import { abilityChanges } from './ability-values';

/**
 * Creature mastery for the screens (docs/03-creatures.md, "Мастерство"; docs/08-architecture.md,
 * section 4): the look, the master level, what the next level brings. Screens decide nothing about
 * mastery themselves, they turn these answers into pictures and lines.
 */

/** Look of a creature: `grown` from `MASTERY.lookLevel` on. Part of the picture key of the layer. */
export type LookStage = 'base' | 'grown';

export function lookStage(level: number): LookStage {
  return clampLevel(level) >= MASTERY.lookLevel ? 'grown' : 'base';
}

/** The creature has its new look at this level. */
export function hasNewLook(level: number): boolean {
  return lookStage(level) === 'grown';
}

/** Master level: the gold frame, the master effect line, the master captions in a run. */
export function isMaster(level: number): boolean {
  return clampLevel(level) >= MASTERY.masterLevel;
}

/**
 * A ladder property without its own number in the ability text, with the numbers its line fills
 * in (i18n `mastery.perk.<id>`, placeholders = keys of `values`).
 */
export interface PerkRow {
  id: PerkId;
  values: Record<string, number>;
}

/** The ladder properties a creature has at `level`. */
export function perksAt(id: CreatureId, level: number): PerkRow[] {
  const at = clampLevel(level);
  const rows: PerkRow[] = [];
  if (id === 'ghost') {
    if (at >= abilityDef('ghost').centreMarkFrom)
      rows.push({ id: 'ghost_centre_mark', values: {} });
  } else if (id === 'rainbow') {
    const def = abilityDef('rainbow');
    const score = levelValue(def.protectedScore, at);
    if (score > 0) rows.push({ id: 'rainbow_protected_score', values: { value: score } });
    if (at >= def.ownLayerFrom) rows.push({ id: 'rainbow_own_layer', values: {} });
  }
  return rows;
}

const sameValues = (a: Record<string, number>, b: Record<string, number>): boolean =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((key) => a[key] === b[key]);

/** What the next level of a creature brings. */
export interface UpgradePreview {
  toLevel: number;
  /** The numbers of the ability text that change, as [placeholder key, from, to]; never from === to. */
  changes: Array<[key: string, from: number, to: number]>;
  /** Ladder properties that are new at `toLevel` or have new numbers there. */
  perks: PerkRow[];
  /** The step brings the new look. */
  newLook: boolean;
  /** The step brings the master effect of this creature (see `masterInfo`), otherwise `null`. */
  master: CreatureId | null;
}

/** What upgrading from `fromLevel` brings; `null` at the maximum level. */
export function upgradePreview(id: CreatureId, fromLevel: number): UpgradePreview | null {
  const from = clampLevel(fromLevel);
  if (from >= MAX_CREATURE_LEVEL) return null;
  const toLevel = from + 1;
  const before = perksAt(id, from);
  const perks = perksAt(id, toLevel).filter(
    (perk) => !before.some((old) => old.id === perk.id && sameValues(old.values, perk.values)),
  );
  return {
    toLevel,
    changes: abilityChanges(id, from, toLevel),
    perks,
    newLook: lookStage(toLevel) !== lookStage(from),
    master: isMaster(toLevel) && !isMaster(from) ? id : null,
  };
}

/** i18n keys of the master effect of a creature and the numbers its phrase fills in. */
export interface MasterInfo {
  /** `mastery.<id>.name`. */
  nameKey: string;
  /** `mastery.<id>.short`: one phrase, placeholders = keys of `values`. */
  shortKey: string;
  values: Record<string, number>;
}

/** The numbers of the master phrases, read from `MASTERY` so the text follows the balance. */
function masterValues(id: CreatureId): Record<string, number> {
  switch (id) {
    case 'honey':
      return { coins: MASTERY.honey.perfectCoins };
    case 'puff':
      return { score: MASTERY.puff.scorePerPx };
    case 'caramel':
      return { mult: MASTERY.caramel.goldenCoinMult };
    case 'frosty':
      return { px: MASTERY.frosty.toleranceAdd };
    case 'brownie':
      return { coins: MASTERY.brownie.shieldCoins };
    case 'sprinkle':
      return { layers: MASTERY.sprinkle.maxExtend };
    case 'crumb':
      return { percent: MASTERY.crumb.pieceShare * PERCENT, coins: MASTERY.crumb.coins };
    case 'twins':
      return { coins: MASTERY.twins.perfectCoins };
    case 'lemon':
      return { layers: abilityDef('lemon').layers, coins: MASTERY.lemon.allPerfectCoins };
    case 'jelly':
    case 'ghost':
    case 'rainbow':
      return {};
  }
}

export function masterInfo(id: CreatureId): MasterInfo {
  return {
    nameKey: `mastery.${id}.name`,
    shortKey: `mastery.${id}.short`,
    values: masterValues(id),
  };
}
