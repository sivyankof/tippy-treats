import { describe, expect, it, vi } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import type { Save } from '../../core/save/schema';
import { WebGames } from '../../services/games/web';
import { GamesSync } from './games-sync';

const DAY = '2026-11-28';

function setup(
  mode: 'signed_in' | 'signed_out' | 'unavailable' | 'refused' = 'signed_in',
  blocked = () => false,
) {
  const games = new WebGames(mode);
  const submit = vi.spyOn(games, 'submitScore');
  const report = vi.spyOn(games, 'reportAchievements');
  const save: Save = createDefaultSave(0, 'test');
  save.stats.runs = 2;
  save.records.classicHeight = 25;
  save.daily = { ...save.daily, day: DAY, best: 18 };
  let runListener: () => void = () => undefined;
  const sync = new GamesSync({
    games,
    save: () => save,
    onRun: (listener) => {
      runListener = listener;
      return () => (runListener = () => undefined);
    },
    utcToday: () => DAY,
    blocked,
  });
  return { games, submit, report, save, sync, run: () => runListener() };
}

describe('GamesSync', () => {
  it('sends the scores and the achievements when the player is signed in', async () => {
    const t = setup();
    await t.games.start();
    t.sync.bind();
    expect(t.submit.mock.calls).toEqual([
      ['classic_height', 25],
      ['daily_height', 18],
    ]);
    const sent = t.report.mock.calls[0]?.[0] ?? [];
    expect(sent.find((a) => a.id === 'height_20')).toEqual({ id: 'height_20', percent: 100 });
    expect(sent.every((a) => a.percent > 0)).toBe(true);
  });

  it('waits for the sign-in and then sends', async () => {
    const t = setup('signed_out');
    await t.games.start();
    t.sync.bind();
    expect(t.submit).not.toHaveBeenCalled();
    await t.games.signIn();
    expect(t.submit).toHaveBeenCalledTimes(2);
  });

  it('after a run sends only what grew', async () => {
    const t = setup();
    await t.games.start();
    t.sync.bind();
    t.submit.mockClear();
    t.report.mockClear();
    t.run();
    expect(t.submit).not.toHaveBeenCalled();
    expect(t.report).not.toHaveBeenCalled();
    t.save.records.classicHeight = 41;
    t.save.stats.runs = 3;
    t.run();
    expect(t.submit.mock.calls).toEqual([['classic_height', 41]]);
    const ids = (t.report.mock.calls[0]?.[0] ?? []).map((a) => a.id);
    expect(ids).toContain('height_40');
    expect(ids).toContain('runs_1');
    expect(ids).not.toContain('height_20');
  });

  it('does nothing while unavailable and stops after unbind', async () => {
    const t = setup('unavailable');
    await t.games.start();
    t.sync.bind();
    t.run();
    expect(t.submit).not.toHaveBeenCalled();
    const s = setup();
    await s.games.start();
    s.sync.bind();
    s.sync.unbind();
    s.submit.mockClear();
    s.save.records.classicHeight = 60;
    s.run();
    expect(s.submit).not.toHaveBeenCalled();
  });

  it('tries a failed send again with the next push', async () => {
    const t = setup();
    await t.games.start();
    t.submit.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    t.report.mockResolvedValueOnce(false);
    t.sync.bind();
    await Promise.resolve();
    await Promise.resolve();
    t.submit.mockClear();
    t.report.mockClear();
    t.run();
    expect(t.submit.mock.calls).toEqual([
      ['classic_height', 25],
      ['daily_height', 18],
    ]);
    expect(t.report).toHaveBeenCalledTimes(1);
  });

  it('sends everything again to an account that signs in after a sign-out', async () => {
    const t = setup();
    await t.games.start();
    t.sync.bind();
    await Promise.resolve();
    t.submit.mockClear();
    const hub = (t.games as unknown as { hub: { set(s: string): void } }).hub;
    hub.set('signed_out');
    hub.set('signed_in');
    expect(t.submit).toHaveBeenCalledTimes(2);
  });

  it('sends nothing while blocked by a debug writer', async () => {
    let blocked = false;
    const t = setup('signed_in', () => blocked);
    await t.games.start();
    blocked = true;
    t.sync.bind();
    t.run();
    expect(t.submit).not.toHaveBeenCalled();
    expect(t.report).not.toHaveBeenCalled();
  });
});
