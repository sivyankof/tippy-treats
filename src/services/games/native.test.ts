import { describe, expect, it, vi } from 'vitest';
import { NativeGames, type GamesPlugin } from './native';

function plugin(over: Partial<GamesPlugin> = {}) {
  let emit: (data: { status: string }) => void = () => undefined;
  const p: GamesPlugin = {
    start: vi.fn(() => Promise.resolve({ status: 'signed_out' })),
    signIn: vi.fn(() => Promise.resolve({ signedIn: true, status: 'signed_in' })),
    submitScore: vi.fn(() => Promise.resolve({ ok: true })),
    showBoard: vi.fn(() => Promise.resolve()),
    reportAchievements: vi.fn(() => Promise.resolve({ ok: true })),
    showAchievements: vi.fn(() => Promise.resolve()),
    addListener: vi.fn((_event, listener) => {
      emit = listener;
      return Promise.resolve({ remove: () => Promise.resolve() });
    }),
    ...over,
  };
  return { p, emit: (status: string) => emit({ status }) };
}

describe('NativeGames', () => {
  it('takes the status the plugin gives at start, once', async () => {
    const { p } = plugin();
    const games = new NativeGames(p);
    await Promise.all([games.start(), games.start()]);
    expect(p.start).toHaveBeenCalledTimes(1);
    expect(games.status()).toBe('signed_out');
  });

  it('follows the status events of the plugin', async () => {
    const { p, emit } = plugin();
    const games = new NativeGames(p);
    const seen: string[] = [];
    games.onStatus((s) => seen.push(s));
    await games.start();
    emit('signed_in');
    emit('garbage');
    expect(seen).toEqual(['signed_out', 'signed_in', 'unavailable']);
  });

  it('is unavailable when the plugin is missing or throws, and never throws itself', async () => {
    const { p } = plugin({
      start: vi.fn(() => Promise.reject(new Error('not implemented'))),
    });
    const games = new NativeGames(p);
    await games.start();
    expect(games.status()).toBe('unavailable');
    expect(await games.signIn()).toBe(false);
    await expect(games.submitScore('classic_height', 5)).resolves.toBe(false);
    expect(p.submitScore).not.toHaveBeenCalled();
  });

  it('signs in through the plugin and reports false when it fails', async () => {
    const ok = plugin();
    const games = new NativeGames(ok.p);
    expect(await games.signIn()).toBe(true);
    expect(games.status()).toBe('signed_in');
    const refused = plugin({
      signIn: vi.fn(() => Promise.resolve({ signedIn: false, status: 'signed_out' })),
    });
    const other = new NativeGames(refused.p);
    expect(await other.signIn()).toBe(false);
    const broken = plugin({ signIn: vi.fn(() => Promise.reject(new Error('x'))) });
    expect(await new NativeGames(broken.p).signIn()).toBe(false);
  });

  it('sends scores and achievements only while signed in and swallows their failures', async () => {
    const { p, emit } = plugin({
      submitScore: vi.fn(() => Promise.reject(new Error('offline'))),
    });
    const games = new NativeGames(p);
    await games.start();
    expect(await games.submitScore('classic_height', 5)).toBe(false);
    expect(p.submitScore).not.toHaveBeenCalled();
    emit('signed_in');
    await expect(games.submitScore('classic_height', 5)).resolves.toBe(false);
    expect(p.submitScore).toHaveBeenCalledWith({ board: 'classic_height', value: 5 });
    await games.reportAchievements([]);
    expect(p.reportAchievements).not.toHaveBeenCalled();
    expect(await games.reportAchievements([{ id: 'runs_1', percent: 10 }])).toBe(true);
    expect(p.reportAchievements).toHaveBeenCalledWith({ items: [{ id: 'runs_1', percent: 10 }] });
    expect(games.status()).toBe('signed_in');
  });
});
