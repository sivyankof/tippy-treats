import type { Cost, Currency } from '../../../core/economy';
import type { NearMiss } from '../../../core/near-miss';
import type { RunTally } from '../../../core/run-tally';
import type { CoinSource } from '../../../core/sim-types';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { t, tn } from '../../../i18n';
import type { LevelUp } from '../../../state/game-state';

/** Order of the sources in the coin breakdown. */
const SOURCE_ORDER: readonly CoinSource[] = [
  'floating',
  'combo',
  'perfect',
  'crumb',
  'golden',
  'height',
];

export interface CoinLine {
  source: CoinSource;
  amount: number;
}

/** The sources that paid at least a coin, in a fixed order. */
export function coinLines(tally: RunTally): CoinLine[] {
  return SOURCE_ORDER.map((source) => ({ source, amount: Math.floor(tally.coins[source]) })).filter(
    (line) => line.amount > 0,
  );
}

/** The "so close" sentence of the results screen. */
export function nearMissText(miss: NearMiss): string {
  switch (miss.kind) {
    case 'record':
      return tn('nearMiss.record', miss.layers);
    case 'xp':
      return tn('nearMiss.xp', miss.xp, { level: miss.level });
    case 'coins':
      return tn('nearMiss.coins', miss.coins, { name: t(CREATURES[miss.creature].nameKey) });
    case 'best':
      return t('nearMiss.best', { n: miss.record });
  }
}

/** Creatures to present after the results: the free ones that are new to the player. */
export function newCreaturesOf(levelUps: readonly LevelUp[]): CreatureId[] {
  const ids: CreatureId[] = [];
  for (const { reward, duplicate } of levelUps) {
    if (reward.creature && duplicate === null) ids.push(reward.creature);
  }
  return ids;
}

export interface Amount {
  currency: Currency;
  amount: number;
}

/** One line of the level-up window. */
export type RewardLine =
  | { kind: 'creature'; id: CreatureId; instead: Amount[] }
  | { kind: 'slot' }
  | { kind: 'shop'; id: CreatureId }
  | { kind: 'daily' }
  | ({ kind: 'gain' } & Amount);

function costParts(cost: Cost): Amount[] {
  const parts: Amount[] = [];
  if (cost.coins) parts.push({ currency: 'coins', amount: cost.coins });
  if (cost.berries) parts.push({ currency: 'berries', amount: cost.berries });
  return parts;
}

/** What a level paid, line by line. */
export function rewardLines(levelUp: LevelUp): RewardLine[] {
  const { reward, duplicate } = levelUp;
  const lines: RewardLine[] = [];
  if (reward.creature) {
    lines.push({
      kind: 'creature',
      id: reward.creature,
      instead: duplicate ? costParts(duplicate) : [],
    });
  }
  if (reward.thirdTeamSlot) lines.push({ kind: 'slot' });
  if (reward.shopUnlock) lines.push({ kind: 'shop', id: reward.shopUnlock });
  if (reward.dailyTower) lines.push({ kind: 'daily' });
  if (reward.coins) lines.push({ kind: 'gain', currency: 'coins', amount: reward.coins });
  if (reward.berries) lines.push({ kind: 'gain', currency: 'berries', amount: reward.berries });
  return lines;
}

/** One piece of the XP bar: it fills from `from` to `to` (fractional levels) within a level. */
export interface XpSegment {
  from: number;
  to: number;
  /** The level reached when the piece ends on a whole level (a level-up), else null. */
  reaches: number | null;
}

/** Splits the fill from `from` to `to` at every whole level in between. */
export function xpSegments(from: number, to: number): XpSegment[] {
  const segments: XpSegment[] = [];
  let at = from;
  while (at < to) {
    const next = Math.floor(at) + 1;
    if (next <= to) {
      segments.push({ from: at, to: next, reaches: next });
      at = next;
    } else {
      segments.push({ from: at, to, reaches: null });
      at = to;
    }
  }
  return segments;
}
