import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { APP_SHELL } from '../../data/app/app-shell';
import type { AppShellService } from '../../services/app-shell/types';
import { ZONE_SKY } from '../../data/backdrop/backdrop-colors';
import { WEATHER_LOOK } from '../../data/weather/weather-look';
import {
  BarIconsHold,
  barIconsOver,
  currentBarIcons,
  followStatusBar,
  watchRunSky,
  watchVeil,
} from './status-bar';

vi.mock('phaser', () => ({
  GameObjects: { Events: { DESTROY: 'destroy' } },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
}));

class Once {
  private readonly fns = new Map<string, () => void>();
  once(event: string, fn: () => void): this {
    this.fns.set(event, fn);
    return this;
  }
  fire(event: string): void {
    this.fns.get(event)?.();
  }
}

function fakeScene(shown = { visible: true, active: true, paused: false }) {
  const events = new Once();
  const scene = {
    events,
    sys: {
      isVisible: () => shown.visible,
      isActive: () => shown.active,
      isPaused: () => shown.paused,
    },
  };
  return { scene: scene as unknown as Phaser.Scene, events, shown };
}

function fakeVeil(scene: Phaser.Scene, fillAlpha = APP_SHELL.statusBar.veilDarkness) {
  const veil = Object.assign(new Once(), { scene, visible: true, alpha: 1, fillAlpha });
  return veil as typeof veil & Phaser.GameObjects.Rectangle;
}

const top = (stops: readonly { color: number }[]): number => stops[0]?.color ?? 0;

describe('barIconsOver', () => {
  it('puts light icons over the dark skies and dark ones over the light skies', () => {
    expect(barIconsOver(top(ZONE_SKY.stars))).toBe('light');
    expect(barIconsOver(top(ZONE_SKY.space))).toBe('light');
    expect(barIconsOver(top(WEATHER_LOOK.sky.night.roof))).toBe('light');
    expect(barIconsOver(top(ZONE_SKY.kitchen))).toBe('dark');
    expect(barIconsOver(top(ZONE_SKY.showcase))).toBe('dark');
    expect(barIconsOver(top(ZONE_SKY.roof))).toBe('dark');
  });
});

describe('currentBarIcons', () => {
  it('is dark over the menus, follows the run sky, and turns light under a veil', () => {
    expect(currentBarIcons()).toBe('dark');
    const run = fakeScene();
    let sky = top(ZONE_SKY.kitchen);
    watchRunSky(run.scene, () => sky);
    expect(currentBarIcons()).toBe('dark');
    sky = top(ZONE_SKY.stars);
    expect(currentBarIcons()).toBe('light');
    sky = top(ZONE_SKY.roof);

    const hud = fakeScene();
    const veil = watchVeil(fakeVeil(hud.scene));
    veil.alpha = 0.5;
    expect(currentBarIcons()).toBe('dark');
    veil.alpha = 1;
    expect(currentBarIcons()).toBe('light');
    hud.shown.visible = false;
    expect(currentBarIcons()).toBe('dark');
    hud.shown.visible = true;
    veil.fire('destroy');
    expect(currentBarIcons()).toBe('dark');

    run.shown.active = false;
    run.shown.paused = true;
    sky = top(ZONE_SKY.space);
    expect(currentBarIcons()).toBe('light');
    run.events.fire('shutdown');
    expect(currentBarIcons()).toBe('dark');
  });
});

describe('BarIconsHold', () => {
  it('lets the first colour through at once and a new one after enough looks agree', () => {
    const hold = new BarIconsHold(2);
    expect(hold.next('dark')).toBe('dark');
    expect(hold.next('dark')).toBeNull();
    expect(hold.next('light')).toBeNull();
    expect(hold.next('dark')).toBeNull();
    expect(hold.next('light')).toBeNull();
    expect(hold.next('light')).toBe('light');
    expect(hold.next('light')).toBeNull();
  });
});

describe('followStatusBar', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const shellOf = (native: boolean) =>
    ({
      native,
      onActiveChange: () => () => undefined,
      onBack: () => () => undefined,
      minimize: () => undefined,
      hideSplash: () => undefined,
      setBarIcons: vi.fn(),
      openExternal: () => undefined,
      deviceInfo: () => Promise.resolve({ model: 'test', os: 'test' }),
      appBuild: () => Promise.resolve(null),
    }) satisfies AppShellService;

  it('sets the icons at once and then only on a lasting change', () => {
    const shell = shellOf(true);
    let seen: 'light' | 'dark' = 'dark';
    const stop = followStatusBar(shell, () => seen);
    expect(shell.setBarIcons.mock.calls).toEqual([['dark']]);
    seen = 'light';
    vi.advanceTimersByTime(APP_SHELL.statusBar.checkMs * APP_SHELL.statusBar.holdChecks);
    expect(shell.setBarIcons.mock.calls).toEqual([['dark'], ['light']]);
    stop();
    seen = 'dark';
    vi.advanceTimersByTime(APP_SHELL.statusBar.checkMs * 10);
    expect(shell.setBarIcons).toHaveBeenCalledTimes(2);
  });

  it('does nothing in a browser', () => {
    const shell = shellOf(false);
    followStatusBar(shell, () => 'light');
    vi.advanceTimersByTime(APP_SHELL.statusBar.checkMs * 10);
    expect(shell.setBarIcons).not.toHaveBeenCalled();
  });
});
