import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import type { Save } from '../../core/save/schema';
import type { RunResult } from '../../core/run/run-result';
import { EMPTY_SUMMARY } from '../run-record';
import {
  earnEvent,
  earnEvents,
  levelUpEvents,
  missionCompleteEvents,
  runEndParams,
  runEvents,
  settingsEvents,
  spendEvents,
  teamEvents,
  unlockEvents,
} from './state-events';

const save = (): Save => createDefaultSave(1_700_000_000_000, 'test');

function result(over: Partial<RunResult> = {}): RunResult {
  return {
    seed: 1,
    mode: 'classic',
    height: 40,
    score: 900,
    coins: 120,
    berries: 2,
    perfects: 5,
    bestCombo: 4,
    continuesUsed: 1,
    zoneIndex: 2,
    durationMs: 61_400,
    endReason: 'miss',
    ...over,
  };
}

describe('runEndParams', () => {
  it('carries every parameter of the table', () => {
    expect(
      runEndParams(result(), { floatingCoins: 0, abilities: 3, maxWobble: 0, flies: 0 }),
    ).toEqual({
      mode: 'classic',
      height: 40,
      score: 900,
      duration_s: 61,
      perfects: 5,
      best_combo: 4,
      coins: 120,
      abilities_used: 3,
      continues: 1,
      zone: 2,
      end_reason: 'miss',
    });
  });
});

describe('runEvents', () => {
  const extras = { floatingCoins: 0, abilities: 0, maxWobble: 0, flies: 0 };
  const names = (events: Array<{ name: string }>): string[] => events.map((e) => e.name);

  it('tells the run end, the large coin credit and nothing else for a plain run', () => {
    const before = { ...save(), stats: { ...save().stats, runs: 4 } };
    const events = runEvents(before, before, result(), EMPTY_SUMMARY, extras);
    expect(names(events)).toEqual(['run_end', 'currency_earn']);
    expect(events[1]?.params).toEqual({ currency: 'coins', amount: 120, source: 'run' });
  });

  it('adds new_record with the previous best, and the end of the tutorial on the first run', () => {
    const summary = { ...EMPTY_SUMMARY, isRecord: true, previousRecord: 25 };
    const events = runEvents(save(), save(), result({ coins: 10 }), summary, extras);
    expect(names(events)).toEqual(['run_end', 'new_record', 'tutorial_complete']);
    expect(events[1]?.params).toEqual({ height: 40, prev: 25 });
    expect(events[2]?.params).toEqual({ height: 40 });
  });

  it('adds level_up, creature_unlock (record or level), mission_complete and daily_attempt', () => {
    const before = save();
    const after = {
      ...before,
      creatures: { ...before.creatures, twins: { level: 1 }, puff: { level: 1 } },
    };
    const item = (progress: number) => ({
      id: 'height_10',
      group: 'easy' as const,
      target: 10,
      progress,
      claimed: false,
    });
    const summary = {
      ...EMPTY_SUMMARY,
      levelUps: [{ level: 3, reward: {}, duplicate: null }],
      recordCreatures: ['twins' as const],
      missions: { before: [item(5)], after: [item(10)] },
    };
    const daily = { ...after, daily: { ...after.daily, attemptsUsed: 2 } };
    const events = runEvents(
      { ...before, stats: { ...before.stats, runs: 3 } },
      daily,
      result({ mode: 'daily', coins: 0 }),
      summary,
      extras,
    );
    expect(events.filter((e) => e.name === 'level_up')[0]?.params).toEqual({ level: 3 });
    const unlocks = events.filter((e) => e.name === 'creature_unlock').map((e) => e.params);
    expect(unlocks).toContainEqual({ creature: 'twins', source: 'record' });
    expect(unlocks).toContainEqual({ creature: 'puff', source: 'level' });
    expect(events.find((e) => e.name === 'mission_complete')?.params).toEqual({
      mission: 'height_10',
      tier: 'easy',
    });
    expect(events.find((e) => e.name === 'daily_attempt')?.params).toEqual({
      attempt: 2,
      height: 40,
    });
  });
});

describe('small builders', () => {
  it('level_up per level', () => {
    expect(
      levelUpEvents([
        { level: 2, reward: {}, duplicate: null },
        { level: 3, reward: {}, duplicate: null },
      ]).map((e) => e.params),
    ).toEqual([{ level: 2 }, { level: 3 }]);
  });

  it('currency_spend only for a currency that went down', () => {
    expect(
      spendEvents({ coins: 100, berries: 5 }, { coins: 40, berries: 5 }, 'creature_x'),
    ).toEqual([
      { name: 'currency_spend', params: { currency: 'coins', amount: 60, item: 'creature_x' } },
    ]);
    expect(spendEvents({ coins: 1, berries: 5 }, { coins: 1, berries: 5 }, 'x')).toEqual([]);
  });

  it('currency_earn only for large sources, never for debug grants or run berries', () => {
    expect(earnEvent('coins', 99, 'gift')).toEqual([]);
    expect(earnEvent('coins', 100, 'gift')).toHaveLength(1);
    expect(earnEvent('berries', 1, 'chest')).toHaveLength(1);
    expect(earnEvent('berries', 50, 'run_berries')).toEqual([]);
    expect(earnEvent('coins', 5000, 'debug')).toEqual([]);
    expect(
      earnEvents({ coins: 0, berries: 0 }, { coins: 500, berries: 3 }, 'purchase'),
    ).toHaveLength(2);
  });

  it('creature_unlock names the new creatures only', () => {
    const before = save();
    const after = { ...before, creatures: { ...before.creatures, twins: { level: 1 } } };
    expect(unlockEvents(before, after, () => 'streak')).toEqual([
      { name: 'creature_unlock', params: { creature: 'twins', source: 'streak' } },
    ]);
    expect(unlockEvents(after, after, () => 'x')).toEqual([]);
  });

  it('mission_complete only when the target is reached by this run', () => {
    const item = (progress: number, claimed = false) => ({
      id: 'm',
      group: 'hard' as const,
      target: 5,
      progress,
      claimed,
    });
    expect(missionCompleteEvents([item(2)], [item(3)])).toEqual([]);
    expect(missionCompleteEvents([item(5)], [item(5)])).toEqual([]);
    expect(missionCompleteEvents([item(4)], [item(5)])).toHaveLength(1);
  });

  it('team_change only when the team differs, empty slots skipped', () => {
    const before = save();
    const after = { ...before, team: ['honey', 'twins', null] as Save['team'] };
    expect(teamEvents(before, after)).toEqual([
      { name: 'team_change', params: { team: 'honey,twins' } },
    ]);
    expect(teamEvents(after, after)).toEqual([]);
  });

  it('settings_change per switch that moved, with 1/0 for switches and notifications per kind', () => {
    const before = save().settings;
    const after = {
      ...before,
      music: false,
      lang: 'ru' as const,
      notifications: { ...before.notifications, streak: false },
    };
    expect(settingsEvents(before, after).map((e) => e.params)).toEqual([
      { key: 'music', value: 0 },
      { key: 'lang', value: 'ru' },
      { key: 'notif_streak', value: 0 },
    ]);
    expect(settingsEvents(before, before)).toEqual([]);
  });
});
