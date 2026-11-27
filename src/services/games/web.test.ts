import { describe, expect, it, vi } from 'vitest';
import { isWebGamesMode, WebGames } from './web';

describe('WebGames', () => {
  it('stays unavailable and silent by default', async () => {
    const log = vi.fn();
    const games = new WebGames(undefined, log);
    await games.start();
    expect(games.status()).toBe('unavailable');
    expect(await games.signIn()).toBe(false);
    await games.submitScore('classic_height', 10);
    expect(log).not.toHaveBeenCalled();
  });

  it('starts in the asked status and tells the listeners once', async () => {
    const games = new WebGames('signed_in');
    const seen: string[] = [];
    games.onStatus((s) => seen.push(s));
    await games.start();
    await games.start();
    expect(games.status()).toBe('signed_in');
    expect(seen).toEqual(['signed_in']);
  });

  it('signs in from signed_out, not in refused', async () => {
    const out = new WebGames('signed_out');
    await out.start();
    expect(await out.signIn()).toBe(true);
    expect(out.status()).toBe('signed_in');
    const refused = new WebGames('refused');
    await refused.start();
    expect(refused.status()).toBe('signed_out');
    expect(await refused.signIn()).toBe(false);
    expect(refused.status()).toBe('signed_out');
  });

  it('writes every call to the log in a debug mode', async () => {
    const log = vi.fn();
    const games = new WebGames('signed_in', log);
    await games.start();
    await games.reportAchievements([{ id: 'runs_1', percent: 40 }]);
    await games.showBoard('daily_height');
    await games.showAchievements();
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      '[games] start → signed_in',
      '[games] reportAchievements runs_1=40',
      '[games] showBoard daily_height',
      '[games] showAchievements',
    ]);
  });

  it('knows its modes', () => {
    expect(isWebGamesMode('refused')).toBe(true);
    expect(isWebGamesMode('on')).toBe(false);
    expect(isWebGamesMode(null)).toBe(false);
  });
});
