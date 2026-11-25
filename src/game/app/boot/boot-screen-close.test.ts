import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { BOOT_SCREEN } from '../../../data/app/boot-screen';
import { parseBootRecord } from '../../../util/boot/boot-screen';
import { closeBootScreenOnFirstScreen, rememberBootPrefs } from './boot-screen-close';

vi.mock('phaser', () => ({
  Core: { Events: { HIDDEN: 'hidden', VISIBLE: 'visible', POST_RENDER: 'postrender' } },
}));
vi.mock('../scene-keys', () => ({ SCENES: { boot: 'boot' } }));

class FakeEvents {
  private readonly listeners = new Map<string, Set<() => void>>();
  on(event: string, fn: () => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(fn);
  }
  off(event: string, fn: () => void): void {
    this.listeners.get(event)?.delete(fn);
  }
  emit(event: string): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn();
  }
}

function setup() {
  const events = new FakeEvents();
  let active = ['boot'];
  const game = {
    events,
    scene: { getScenes: () => active.map((key) => ({ scene: { key } })) },
  } as unknown as Phaser.Game;
  const done = vi.fn();
  const win = { __tippyBoot: { done } } as unknown as Window;
  closeBootScreenOnFirstScreen(game, win);
  return {
    events,
    done,
    show: (keys: string[]) => {
      active = keys;
    },
  };
}

describe('closing the boot screen', () => {
  it('waits for a frame of a screen of the game, not of the boot scene', () => {
    const t = setup();
    t.events.emit('postrender');
    expect(t.done).not.toHaveBeenCalled();
    t.show(['home']);
    t.events.emit('postrender');
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  it('asks once: frames after it and coming back from the background do nothing', () => {
    const t = setup();
    t.show(['game', 'hud']);
    t.events.emit('postrender');
    t.events.emit('hidden');
    t.events.emit('visible');
    t.events.emit('postrender');
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  it('copies the settings for the next cold start and keeps the launch count', () => {
    const store = new Map<string, string>([[BOOT_SCREEN.storageKey, '{"launches":5}']]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    rememberBootPrefs('en', 'on', storage);
    expect(parseBootRecord(store.get(BOOT_SCREEN.storageKey) ?? null)).toEqual({
      launches: 5,
      lang: 'en',
      fx: 'on',
    });
  });
});
