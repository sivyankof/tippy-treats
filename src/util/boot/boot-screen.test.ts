import { describe, expect, it } from 'vitest';
import {
  type BootConfig,
  type BootEnv,
  type BootVariant,
  isCalm,
  langOfChoice,
  parseBootRecord,
  parseSafeInsets,
  readBootDebug,
  startBootScreen,
  variantOfLaunch,
  withBootPrefs,
} from './boot-screen';

const CONFIG: BootConfig = {
  storageKey: 'boot',
  minShowMs: 1200,
  maxShowMs: 8000,
  fadeOutMs: 300,
  fontWaitMs: 1000,
  splashFadeMs: 250,
  debug: false,
};

/** A page with a fake clock: timers run when `advance` passes them. */
function fakePage(options: { stored?: string; search?: string; reduce?: boolean } = {}) {
  let clock = 0;
  const timers: Array<{ at: number; run: () => void }> = [];
  const store = new Map<string, string>();
  if (options.stored !== undefined) store.set(CONFIG.storageKey, options.stored);
  const log: string[] = [];
  let paint: (() => void) | null = null;
  const env: BootEnv = {
    now: () => clock,
    later: (ms, run) => timers.push({ at: clock + ms, run }),
    afterPaint: (run) => {
      paint = run;
    },
    read: (key) => store.get(key) ?? null,
    write: (key, value) => store.set(key, value),
    locales: ['ru-RU'],
    systemReduce: options.reduce ?? false,
    search: options.search ?? '',
    fontsReady: () => new Promise(() => undefined),
    view: {
      show: (variant, lang, calm) => log.push(`show ${variant} ${lang}${calm ? ' calm' : ''}`),
      play: () => log.push('play'),
      fadeOut: () => log.push('fade'),
      remove: () => log.push('remove'),
    },
    hideSplash: () => log.push('splash'),
  };
  const advance = (ms: number): void => {
    const until = clock + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > until) break;
      timers.shift();
      clock = next.at;
      next.run();
    }
    clock = until;
  };
  return {
    env,
    log,
    store,
    advance,
    painted: () => paint?.(),
    launches: () => parseBootRecord(store.get(CONFIG.storageKey) ?? null).launches,
  };
}

/** Cold starts on one device, one page load each. */
function launchVariants(count: number): BootVariant[] {
  const store = new Map<string, string>();
  const seen: BootVariant[] = [];
  for (let i = 0; i < count; i++) {
    const page = fakePage(
      store.has(CONFIG.storageKey) ? { stored: store.get(CONFIG.storageKey) } : {},
    );
    seen.push(startBootScreen(page.env, CONFIG).variant);
    store.set(CONFIG.storageKey, page.store.get(CONFIG.storageKey) ?? '');
  }
  return seen;
}

describe('boot screen variants', () => {
  it('shows the tower first, then the oven and the tower in turn', () => {
    expect(launchVariants(5)).toEqual(['tower', 'oven', 'tower', 'oven', 'tower']);
  });

  it('alternates by the count of launches', () => {
    expect(variantOfLaunch(0)).toBe('tower');
    expect(variantOfLaunch(1)).toBe('oven');
    expect(variantOfLaunch(10)).toBe('tower');
  });

  it('reads a broken or foreign record as a fresh device', () => {
    for (const raw of [null, '', '{', '7', 'null', '{"launches":-1}', '{"launches":1.5}']) {
      expect(parseBootRecord(raw).launches).toBe(0);
    }
    expect(parseBootRecord('{"launches":3,"lang":"de","fx":"x"}')).toEqual({
      launches: 3,
      lang: 'auto',
      fx: 'auto',
    });
  });

  it('keeps the count when the game writes its settings', () => {
    const raw = withBootPrefs('{"launches":4,"lang":"auto","fx":"auto"}', 'en', 'on');
    expect(parseBootRecord(raw)).toEqual({ launches: 4, lang: 'en', fx: 'on' });
  });

  it('takes the debug parameters only in a debug build', () => {
    const page = fakePage({ stored: '{"launches":1}', search: '?loader=tower' });
    expect(startBootScreen(page.env, CONFIG).variant).toBe('oven');
    const debugPage = fakePage({ stored: '{"launches":1}', search: '?loader=a' });
    expect(startBootScreen(debugPage.env, { ...CONFIG, debug: true }).variant).toBe('tower');
    expect(debugPage.launches()).toBe(2);
  });

  it('starts the count over with ?loader=reset', () => {
    const page = fakePage({ stored: '{"launches":7}', search: '?loader=reset' });
    expect(startBootScreen(page.env, { ...CONFIG, debug: true }).variant).toBe('tower');
    expect(page.launches()).toBe(1);
  });
});

describe('boot screen look', () => {
  it('follows the language setting, and the system when it is auto', () => {
    expect(langOfChoice('auto', ['ru-RU'])).toBe('ru');
    expect(langOfChoice('auto', ['en-GB', 'ru-RU'])).toBe('en');
    expect(langOfChoice('en', ['ru-RU'])).toBe('en');
    const page = fakePage({ stored: '{"launches":0,"lang":"en"}' });
    startBootScreen(page.env, CONFIG);
    expect(page.log[0]).toBe('show tower en');
  });

  it('stands still with fewer effects, or with the system reduced motion unless the player said off', () => {
    expect(isCalm('on', false)).toBe(true);
    expect(isCalm('auto', true)).toBe(true);
    expect(isCalm('off', true)).toBe(false);
    expect(isCalm('auto', false)).toBe(false);
    const page = fakePage({ stored: '{"launches":1,"fx":"on"}' });
    startBootScreen(page.env, CONFIG);
    expect(page.log[0]).toBe('show oven ru calm');
  });

  it('starts the title once the fonts are there, or when the wait is over', () => {
    const page = fakePage();
    startBootScreen(page.env, CONFIG);
    page.advance(CONFIG.fontWaitMs - 1);
    expect(page.log).not.toContain('play');
    page.advance(1);
    expect(page.log.filter((line) => line === 'play')).toHaveLength(1);
  });

  it('takes the app splash away once the screen is painted, not when the game is ready', () => {
    const page = fakePage();
    startBootScreen(page.env, CONFIG);
    expect(page.log).not.toContain('splash');
    page.painted();
    expect(page.log).toContain('splash');
  });

  it('reads ?safe= the same way as the game', () => {
    expect(parseSafeInsets('59,34')).toEqual({ top: 59, bottom: 34 });
    expect(parseSafeInsets('59')).toBeUndefined();
    expect(parseSafeInsets('300,0')).toBeUndefined();
    expect(readBootDebug('?loaderHold=15000&safe=47,34')).toEqual({
      reset: false,
      holdMs: 15000,
      safe: { top: 47, bottom: 34 },
    });
  });
});

describe('boot screen leaving', () => {
  it('stays its minimum after the first paint when the game is quick', () => {
    const page = fakePage();
    const boot = startBootScreen(page.env, CONFIG);
    page.advance(100);
    page.painted();
    page.advance(200);
    boot.done();
    page.advance(CONFIG.minShowMs - 201);
    expect(boot.state()).toBe('showing');
    page.advance(1);
    expect(boot.state()).toBe('leaving');
    page.advance(CONFIG.fadeOutMs);
    expect(boot.state()).toBe('gone');
    expect(page.log.filter((line) => line === 'remove')).toHaveLength(1);
  });

  it('dissolves at once when the game comes after the minimum', () => {
    const page = fakePage();
    const boot = startBootScreen(page.env, CONFIG);
    page.painted();
    page.advance(2500);
    boot.done();
    page.advance(0);
    expect(boot.state()).toBe('leaving');
  });

  it('goes away by the safety time when the game never draws (an error)', () => {
    const page = fakePage();
    const boot = startBootScreen(page.env, CONFIG);
    page.painted();
    page.advance(CONFIG.maxShowMs - 1);
    expect(boot.state()).toBe('showing');
    page.advance(1);
    expect(boot.state()).toBe('leaving');
    page.advance(CONFIG.fadeOutMs);
    expect(boot.state()).toBe('gone');
  });

  it('never stays past the safety time, even before its own first paint', () => {
    const page = fakePage();
    const boot = startBootScreen(page.env, CONFIG);
    page.advance(CONFIG.maxShowMs + CONFIG.fadeOutMs);
    expect(boot.state()).toBe('gone');
  });

  it('holds longer with ?loaderHold= in a debug build', () => {
    const page = fakePage({ search: '?loaderHold=15000' });
    const boot = startBootScreen(page.env, { ...CONFIG, debug: true });
    page.painted();
    boot.done();
    page.advance(14999);
    expect(boot.state()).toBe('showing');
    page.advance(1);
    expect(boot.state()).toBe('leaving');
  });

  it('does nothing more once gone: a later call (the app back from the background) shows nothing', () => {
    const page = fakePage();
    const boot = startBootScreen(page.env, CONFIG);
    page.painted();
    boot.done();
    page.advance(CONFIG.minShowMs + CONFIG.fadeOutMs + CONFIG.maxShowMs);
    const lines = page.log.length;
    boot.done();
    page.advance(CONFIG.maxShowMs);
    expect(page.log.length).toBe(lines);
    expect(page.log.filter((line) => line.startsWith('show'))).toHaveLength(1);
    expect(page.launches()).toBe(1);
  });
});
