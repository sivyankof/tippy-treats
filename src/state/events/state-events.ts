// The analytics events the save layer sends (docs/09-services-analytics.md, section 6), built as
// pure functions over saves and run results, so each set of parameters has a test.
import type { RunResult } from '../../core/run/run-result';
import type { Save } from '../../core/save/schema';
import { TELEMETRY } from '../../data/app/telemetry';
import type { EventParams } from '../../services/telemetry/types';
import { MS_PER_SECOND } from '../../util/math';
import type { LevelUp, RunSummary } from '../run-record';
import type { RunExtras } from '../run-progress';
import type { CreditSource } from '../session-tally';

export interface TelemetryEvent {
  name: string;
  params?: EventParams;
}

type Money = Pick<Save, 'coins' | 'berries'>;
type Currency = keyof Money;
const CURRENCIES: readonly Currency[] = ['coins', 'berries'];

/** `level_up` for every level a gain of XP reached. */
export function levelUpEvents(levelUps: readonly LevelUp[]): TelemetryEvent[] {
  return levelUps.map((up) => ({ name: 'level_up', params: { level: up.level } }));
}

/** `creature_unlock` for each creature `after` owns and `before` did not; `source` names where it came from. */
export function unlockEvents(
  before: Save,
  after: Save,
  source: (id: string) => string,
): TelemetryEvent[] {
  return Object.keys(after.creatures)
    .filter((id) => before.creatures[id as keyof Save['creatures']] === undefined)
    .map((id) => ({ name: 'creature_unlock', params: { creature: id, source: source(id) } }));
}

/** `currency_spend` for every currency that went down between two wallets; `item` is what it paid for. */
export function spendEvents(before: Money, after: Money, item: string): TelemetryEvent[] {
  return CURRENCIES.flatMap((currency) => {
    const amount = before[currency] - after[currency];
    return amount > 0 ? [{ name: 'currency_spend', params: { currency, amount, item } }] : [];
  });
}

/**
 * `currency_earn` for a credit of `amount`: only a large source (`TELEMETRY.earnMin`), and never
 * a debug grant or the berries picked up in a run.
 */
export function earnEvent(
  currency: Currency,
  amount: number,
  source: CreditSource | string,
): TelemetryEvent[] {
  if ((TELEMETRY.earnSkip as readonly string[]).includes(source)) return [];
  if (amount < TELEMETRY.earnMin[currency]) return [];
  return [{ name: 'currency_earn', params: { currency, amount, source } }];
}

/** `currency_earn` for what the wallet gained between two saves. */
export function earnEvents(before: Money, after: Money, source: CreditSource): TelemetryEvent[] {
  return CURRENCIES.flatMap((currency) =>
    earnEvent(currency, after[currency] - before[currency], source),
  );
}

/** `mission_complete` for each mission whose progress just reached its target. */
export function missionCompleteEvents(
  before: Save['missions']['items'],
  after: Save['missions']['items'],
): TelemetryEvent[] {
  return after.flatMap((item, index) => {
    const was = before[index];
    if (!was || was.id !== item.id) return [];
    if (was.progress >= was.target || item.progress < item.target) return [];
    return [{ name: 'mission_complete', params: { mission: item.id, tier: item.group } }];
  });
}

/** `team_change` when the saved team differs, with the ids in slot order (empty slots skipped). */
export function teamEvents(before: Save, after: Save): TelemetryEvent[] {
  const ids = (save: Save): string => save.team.filter((id) => id !== null).join(',');
  const next = ids(after);
  return next === ids(before) ? [] : [{ name: 'team_change', params: { team: next } }];
}

/** `settings_change` for each switch that moved (`notifications` per kind); the value is 1 or 0, or the language. */
export function settingsEvents(
  before: Save['settings'],
  after: Save['settings'],
): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  const note = (key: string, was: unknown, now: unknown): void => {
    if (was === now) return;
    const value = typeof now === 'boolean' ? (now ? 1 : 0) : String(now);
    events.push({ name: 'settings_change', params: { key, value } });
  };
  for (const key of ['music', 'sfx', 'haptics', 'reducedFx', 'lang'] as const)
    note(key, before[key], after[key]);
  for (const kind of Object.keys(after.notifications) as Array<
    keyof Save['settings']['notifications']
  >)
    note(`notif_${kind}`, before.notifications[kind], after.notifications[kind]);
  return events;
}

/** Parameters of `run_end`. */
export function runEndParams(result: RunResult, extras: RunExtras): EventParams {
  return {
    mode: result.mode,
    height: result.height,
    score: result.score,
    duration_s: Math.round(result.durationMs / MS_PER_SECOND),
    perfects: result.perfects,
    best_combo: result.bestCombo,
    coins: result.coins,
    abilities_used: extras.abilities,
    continues: result.continuesUsed,
    zone: result.zoneIndex,
    end_reason: result.endReason,
  };
}

/**
 * Everything a finished run that reached the save tells: `run_end`, the record, the end of the
 * tutorial (the first run ever), levels, creatures it opened, missions it completed, the daily
 * attempt and the coins it paid.
 */
export function runEvents(
  before: Save,
  after: Save,
  result: RunResult,
  summary: RunSummary,
  extras: RunExtras,
): TelemetryEvent[] {
  const events: TelemetryEvent[] = [{ name: 'run_end', params: runEndParams(result, extras) }];
  if (summary.isRecord)
    events.push({
      name: 'new_record',
      params: { height: result.height, prev: summary.previousRecord ?? 0 },
    });
  if (before.stats.runs === 0)
    events.push({ name: 'tutorial_complete', params: { height: result.height } });
  events.push(...levelUpEvents(summary.levelUps));
  events.push(
    ...unlockEvents(before, after, (id) =>
      summary.recordCreatures.includes(id as (typeof summary.recordCreatures)[number])
        ? 'record'
        : 'level',
    ),
  );
  events.push(...missionCompleteEvents(summary.missions.before, summary.missions.after));
  if (result.mode === 'daily')
    events.push({
      name: 'daily_attempt',
      params: { attempt: after.daily.attemptsUsed, height: result.height },
    });
  events.push(...earnEvent('coins', result.coins, 'run'));
  events.push(...earnEvent('berries', summary.lapBerries, 'lap'));
  return events;
}
