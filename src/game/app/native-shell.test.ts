import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { APP_SHELL } from '../../data/app/app-shell';
import type { AppShellService } from '../../services/app-shell/types';
import type { AudioService } from '../../services/audio/types';
import { bindNativeShell } from './native-shell';

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

function setup(native = true) {
  const events = new FakeEvents();
  let active: string[] = ['boot'];
  const game = {
    events,
    scene: { getScenes: () => active.map((key) => ({ scene: { key } })) },
  } as unknown as Phaser.Game;
  let onActive: (value: boolean) => void = () => undefined;
  const shell = {
    native,
    onActiveChange: vi.fn((cb: (value: boolean) => void) => {
      onActive = cb;
      return () => undefined;
    }),
    onBack: vi.fn(() => () => undefined),
    minimize: vi.fn(),
    hideSplash: vi.fn(),
  } satisfies AppShellService;
  const audio = { unlock: vi.fn() } as unknown as AudioService & {
    unlock: ReturnType<typeof vi.fn>;
  };
  const state = { flush: vi.fn() };
  bindNativeShell(game, shell, audio, state);
  return {
    events,
    shell,
    audio,
    state,
    setActive: (value: boolean) => onActive(value),
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

  it('starts the audio at once and asks it again a little after the app is back', () => {
    const t = setup();
    expect(t.audio.unlock).toHaveBeenCalledTimes(1);
    t.setActive(false);
    t.setActive(true);
    vi.advanceTimersByTime(APP_SHELL.audioRetryMs);
    expect(t.audio.unlock).toHaveBeenCalledTimes(2);
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

  it('hides the splash anyway when no screen draws in time', () => {
    const t = setup();
    vi.advanceTimersByTime(APP_SHELL.splashMaxMs);
    expect(t.shell.hideSplash).toHaveBeenCalledTimes(1);
  });
});
