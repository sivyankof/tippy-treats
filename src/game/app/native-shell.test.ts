import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { APP_SHELL } from '../../data/app/app-shell';
import type { AppShellService } from '../../services/app-shell/types';
import type { AudioService } from '../../services/audio/types';
import { bindNativeShell } from './native-shell';
import { pushBack } from './back-stack';

vi.mock('phaser', () => ({
  Core: { Events: { HIDDEN: 'hidden', VISIBLE: 'visible', POST_RENDER: 'postrender' } },
}));
vi.mock('./scene-keys', () => ({ SCENES: { boot: 'boot' } }));

class FakeEvents {
  readonly emitted: string[] = [];
  private readonly listeners = new Map<string, Set<() => void>>();
  on(event: string, fn: () => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(fn);
  }
  off(event: string, fn: () => void): void {
    this.listeners.get(event)?.delete(fn);
  }
  emit(event: string): void {
    this.emitted.push(event);
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn();
  }
}

/** What the first screen asked of the music before the shell looks (a test sets it). */
const firstAsk: { track: string | null } = { track: null };

function setup(native = true) {
  const events = new FakeEvents();
  let active: string[] = ['boot'];
  const game = {
    events,
    scene: { getScenes: () => active.map((key) => ({ scene: { key } })) },
  } as unknown as Phaser.Game;
  let onActive: (value: boolean) => void = () => undefined;
  let onBack: () => void = () => undefined;
  const shell = {
    native,
    onActiveChange: vi.fn((cb: (value: boolean) => void) => {
      onActive = cb;
      return () => undefined;
    }),
    onBack: vi.fn((cb: () => void) => {
      onBack = cb;
      return () => undefined;
    }),
    minimize: vi.fn(),
    hideSplash: vi.fn(),
    setBarIcons: vi.fn(),
    openExternal: vi.fn(),
  } satisfies AppShellService;
  const audioCalls: string[] = [];
  const audio = {
    music: {
      playlist: vi.fn(() => audioCalls.push('playlist')),
      state: () => ({ track: firstAsk.track, playlist: false }),
    },
    unlock: vi.fn(() => audioCalls.push('unlock')),
    suspend: vi.fn((reason: string) => audioCalls.push(`suspend ${reason}`)),
    resume: vi.fn((reason: string) => audioCalls.push(`resume ${reason}`)),
  } as unknown as AudioService & { unlock: ReturnType<typeof vi.fn> };
  const state = { flush: vi.fn() };
  bindNativeShell(game, shell, audio, state);
  return {
    events,
    shell,
    audio,
    audioCalls,
    state,
    setActive: (value: boolean) => onActive(value),
    back: () => onBack(),
    showScreens: (keys: string[]) => (active = keys),
  };
}

describe('bindNativeShell', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does nothing in a browser', () => {
    const t = setup(false);
    expect(t.shell.onActiveChange).not.toHaveBeenCalled();
    expect(t.audio.unlock).not.toHaveBeenCalled();
  });

  it('writes the save and pauses the game once when the app leaves, resumes it on return', () => {
    const t = setup();
    t.setActive(false);
    t.setActive(false);
    expect(t.state.flush).toHaveBeenCalledTimes(2);
    expect(t.events.emitted.filter((e) => e === 'hidden')).toHaveLength(1);
    t.setActive(true);
    expect(t.events.emitted.filter((e) => e === 'visible')).toHaveLength(1);
    t.setActive(true);
    expect(t.events.emitted.filter((e) => e === 'visible')).toHaveLength(1);
  });

  it('starts the audio at once; holds it when the app leaves and lets it go only once the app is active', () => {
    const t = setup();
    expect(t.audioCalls).toEqual(['unlock']);
    t.setActive(false);
    // The page shows again before the app is active (owner log, 81.93 then 82.24): nothing here.
    t.events.emit('visible');
    expect(t.audioCalls).toEqual(['unlock', 'suspend app']);
    t.setActive(true);
    vi.advanceTimersByTime(5000);
    expect(t.audioCalls).toEqual(['unlock', 'suspend app', 'resume app']);
  });

  it('asks for the playlist once, with the first frame of a screen of the game (a tutorial asks nothing itself)', () => {
    const t = setup();
    t.events.emit('postrender');
    expect(t.audioCalls).not.toContain('playlist');
    t.showScreens(['boot', 'game']);
    t.events.emit('postrender');
    t.events.emit('postrender');
    expect(t.audioCalls.filter((c) => c === 'playlist')).toHaveLength(1);
  });

  it('leaves the music alone when the first screen asked for a track of its own (the daily tower)', () => {
    firstAsk.track = 'daily';
    try {
      const t = setup();
      t.showScreens(['boot', 'hud']);
      t.events.emit('postrender');
      expect(t.audioCalls).not.toContain('playlist');
    } finally {
      firstAsk.track = null;
    }
  });

  it('hides the splash after the first frame of a screen of the game, not of the boot scene', () => {
    const t = setup();
    t.events.emit('postrender');
    expect(t.shell.hideSplash).not.toHaveBeenCalled();
    t.showScreens(['boot', 'home']);
    t.events.emit('postrender');
    t.events.emit('postrender');
    expect(t.shell.hideSplash).toHaveBeenCalledTimes(1);
  });

  it('gives the back to the topmost screen or window, and sends the app away when none takes it', () => {
    const t = setup();
    const remove = pushBack(() => true);
    t.back();
    expect(t.shell.minimize).not.toHaveBeenCalled();
    remove();
    t.back();
    expect(t.shell.minimize).toHaveBeenCalledTimes(1);
  });

  it('hides the splash anyway when no screen draws in time', () => {
    const t = setup();
    vi.advanceTimersByTime(APP_SHELL.splashMaxMs);
    expect(t.shell.hideSplash).toHaveBeenCalledTimes(1);
  });
});
