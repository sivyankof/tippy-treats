import { abilityValues } from '../../../../core/creatures/ability-values';
import { unlockHint, unlockHints, type UnlockHint } from '../../../../core/progression/collection';
import {
  creaturePrice,
  upgradeCost,
  upgradeGate,
  upgradeLocked,
  type PriceOption,
} from '../../../../core/economy/economy';
import {
  CREATURES,
  MAX_CREATURE_LEVEL,
  type CreatureId,
} from '../../../../data/creatures/creatures';
import { formatDecimal, t } from '../../../../i18n';

/** What the main button area of a creature card offers. */
export type MainAction =
  | { kind: 'upgrade'; price: number }
  /** The upgrade waits for a baker level. */
  | { kind: 'upgradeFrom'; minBakerLevel: number }
  | { kind: 'maxLevel' }
  /** `otherWays`: the free ways to get the creature besides the shop. */
  | { kind: 'buy'; options: PriceOption[]; otherWays: UnlockHint[] }
  | {
      kind: 'shopFrom';
      minBakerLevel: number;
      price: number;
      currency: PriceOption['currency'];
      otherWays: UnlockHint[];
    }
  | { kind: 'howTo'; hint: UnlockHint };

/** The ways to get a creature other than its shop price. */
function otherWays(id: CreatureId): UnlockHint[] {
  return unlockHints(id).filter((hint) => hint.kind !== 'shop');
}

/** `level` is the owned level, or `null` when the player does not own the creature. */
export function mainAction(id: CreatureId, level: number | null, bakerLevel: number): MainAction {
  if (level !== null) {
    const price = level >= MAX_CREATURE_LEVEL ? null : upgradeCost(level);
    if (price === null) return { kind: 'maxLevel' };
    return upgradeLocked(id, level, bakerLevel)
      ? { kind: 'upgradeFrom', minBakerLevel: upgradeGate(id, level) ?? 1 }
      : { kind: 'upgrade', price };
  }
  const options = creaturePrice(id, bakerLevel);
  if (options.length > 0) return { kind: 'buy', options, otherWays: otherWays(id) };
  const hint = unlockHint(id);
  return hint.kind === 'shop'
    ? {
        kind: 'shopFrom',
        minBakerLevel: hint.minBakerLevel,
        price: hint.price,
        currency: hint.currency,
        otherWays: otherWays(id),
      }
    : { kind: 'howTo', hint };
}

/** How much is missing to pay `price` with `have`; 0 when it is enough. */
export function missingAmount(price: number, have: number): number {
  return Math.max(0, price - have);
}

/** Ability values as text for the `{value}` placeholders of the description. */
export function formatValues(
  values: Record<string, number>,
  format: (value: number) => string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, format(value)]));
}

/** The ability description of a creature at `level`, with its numbers filled in. */
export function abilityText(id: CreatureId, level: number): string {
  return t(CREATURES[id].descKey, formatValues(abilityValues(id, level), formatDecimal));
}
