/**
 * The boot screen of index.html (docs/07-ui-screens.md, section 1): the tower or the oven, in turn
 * from launch to launch, shown before any module of the game loads and taken away after the first
 * frame of a screen of the game.
 *
 * The page runs this file as a plain inline script, before the modules: the `boot-screen` plugin of
 * vite.config.ts strips its types, drops the `export` words and inlines it into index.html with the
 * numbers of `BOOT_SCREEN` (src/data/app/boot-screen.ts). So it has no imports and touches the page
 * only through `domBootEnv`; the game reaches it through `window.__tippyBoot` (game/app/boot/).
 */

/** Which picture the boot screen shows. */
export type BootVariant = 'tower' | 'oven';

export type BootLang = 'ru' | 'en';

/** The "fewer effects" switch of the save: `on` is the player's own "fewer". */
export type BootFx = 'auto' | 'on' | 'off';

/** What the device remembers for the boot screen (it lives apart from the save, which loads later). */
export interface BootRecord {
  /** Cold starts so far; the next one shows `variantOfLaunch(launches)`. */
  launches: number;
  /** The language setting of the save (`auto` follows the system). */
  lang: BootLang | 'auto';
  /** The "fewer effects" setting of the save. */
  fx: BootFx;
}

export interface BootConfig {
  /** localStorage key of the record. */
  storageKey: string;
  /** The screen stays at least this long after its first paint, so it never only flashes. */
  minShowMs: number;
  /** The screen goes away by then in any case, the game or not (an error box must show). */
  maxShowMs: number;
  /** Length of the dissolve. */
  fadeOutMs: number;
  /** The title waits this long at most for the Nunito files before it hops in. */
  fontWaitMs: number;
  /** The launch splash of the app fades out this long once the boot screen is painted. */
  splashFadeMs: number;
  /** Dev server and internal build: the `?loader=`, `?loaderHold=` and `?safe=` parameters work. */
  debug: boolean;
}

/** The debug parameters of the boot screen (only with `BootConfig.debug`). */
export interface BootDebug {
  /** `?loader=tower|oven` (or `a|b`): shows that one; the count still goes on. */
  force?: BootVariant;
  /** `?loader=reset`: the count starts over, so this launch is the first one (the tower). */
  reset: boolean;
  /** `?loaderHold=15000`: the screen stays at least this long (ms), to look at the animation. */
  holdMs: number;
  /** `?safe=top,bottom`: stands in for the safe-area insets (CSS px). */
  safe?: SafeInsetPair;
}

export interface SafeInsetPair {
  top: number;
  bottom: number;
}

/** What the boot screen does on the page; `domBootEnv` is the real one, tests use fakes. */
export interface BootView {
  show(variant: BootVariant, lang: BootLang, calm: boolean, safe: SafeInsetPair | undefined): void;
  /** The fonts are there (or the wait is over): the title hops in and the phrases start. */
  play(): void;
  fadeOut(ms: number): void;
  remove(): void;
}

export interface BootEnv {
  now(): number;
  later(ms: number, run: () => void): void;
  /** Calls `run` once the page has painted what is on it now. */
  afterPaint(run: () => void): void;
  read(key: string): string | null;
  write(key: string, value: string): void;
  locales: readonly string[];
  /** The system asks for reduced motion. */
  systemReduce: boolean;
  search: string;
  fontsReady(): Promise<unknown>;
  view: BootView;
  /** Takes the launch splash of the app away (nothing in a browser). */
  hideSplash(fadeMs: number): void;
}

export type BootState = 'showing' | 'leaving' | 'gone';

export interface BootHandle {
  readonly variant: BootVariant;
  /** The first frame of a screen of the game is drawn: the screen dissolves (not before its minimum). */
  done(): void;
  state(): BootState;
}

/** Russian when the system (first) locale is Russian, English otherwise. */
export function langOfLocales(locales: readonly string[]): BootLang {
  return locales[0]?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** The language a setting stands for: `auto` follows the system locales. */
export function langOfChoice(choice: BootLang | 'auto', locales: readonly string[]): BootLang {
  return choice === 'auto' ? langOfLocales(locales) : choice;
}

const FRESH_RECORD: BootRecord = { launches: 0, lang: 'auto', fx: 'auto' };

/** Reads the stored record; anything broken or missing reads as a fresh device. */
export function parseBootRecord(raw: string | null): BootRecord {
  if (raw === null) return { ...FRESH_RECORD };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ...FRESH_RECORD };
  }
  if (typeof value !== 'object' || value === null) return { ...FRESH_RECORD };
  const record = value as Record<string, unknown>;
  const launches = record.launches;
  const lang = record.lang;
  const fx = record.fx;
  return {
    launches:
      typeof launches === 'number' && Number.isInteger(launches) && launches >= 0 ? launches : 0,
    lang: lang === 'ru' || lang === 'en' ? lang : 'auto',
    fx: fx === 'on' || fx === 'off' ? fx : 'auto',
  };
}

/** The first launch shows the tower, then the oven and the tower in turn. */
export function variantOfLaunch(launches: number): BootVariant {
  return launches % 2 === 0 ? 'tower' : 'oven';
}

/**
 * A still picture: the player's "fewer effects", or the system's reduced motion unless the player
 * turned "fewer effects" off themselves (the same rule as the effects level, docs/06, section 9).
 */
export function isCalm(fx: BootFx, systemReduce: boolean): boolean {
  return fx === 'on' || (fx === 'auto' && systemReduce);
}

/** The record with the settings of the save in it; the count of launches stays. */
export function withBootPrefs(raw: string | null, lang: BootLang | 'auto', fx: BootFx): string {
  return JSON.stringify({ ...parseBootRecord(raw), lang, fx });
}

const MAX_SAFE_INSET = 200;

/** `?safe=top,bottom`: two whole CSS px values from 0 to 200. */
export function parseSafeInsets(raw: string | null): SafeInsetPair | undefined {
  const match = raw === null ? null : /^(\d{1,3}),(\d{1,3})$/.exec(raw.trim());
  if (!match) return undefined;
  const top = Number(match[1]);
  const bottom = Number(match[2]);
  return top <= MAX_SAFE_INSET && bottom <= MAX_SAFE_INSET ? { top, bottom } : undefined;
}

const MAX_HOLD_MS = 120000;

export function readBootDebug(search: string): BootDebug {
  const params = new URLSearchParams(search);
  const loader = (params.get('loader') ?? '').toLowerCase();
  const hold = Number(params.get('loaderHold'));
  const result: BootDebug = {
    reset: loader === 'reset',
    holdMs: Number.isFinite(hold) && hold > 0 ? Math.min(Math.round(hold), MAX_HOLD_MS) : 0,
  };
  if (loader === 'tower' || loader === 'a') result.force = 'tower';
  if (loader === 'oven' || loader === 'b') result.force = 'oven';
  const safe = parseSafeInsets(params.get('safe'));
  if (safe) result.safe = safe;
  return result;
}

/**
 * Shows the boot screen of this launch and counts the launch. Runs once per page load (a cold
 * start); coming back from the background reloads nothing, so it never shows again then.
 */
export function startBootScreen(env: BootEnv, config: BootConfig): BootHandle {
  const debug: BootDebug = config.debug ? readBootDebug(env.search) : { reset: false, holdMs: 0 };
  const startedAt = env.now();
  let record = parseBootRecord(env.read(config.storageKey));
  if (debug.reset) record = { ...record, launches: 0 };
  const variant = debug.force ?? variantOfLaunch(record.launches);
  env.write(config.storageKey, JSON.stringify({ ...record, launches: record.launches + 1 }));

  let state: BootState = 'showing';
  let shownAt = startedAt;
  env.view.show(
    variant,
    langOfChoice(record.lang, env.locales),
    isCalm(record.fx, env.systemReduce),
    debug.safe,
  );
  env.afterPaint(() => {
    shownAt = env.now();
    env.hideSplash(config.splashFadeMs);
  });

  let playing = false;
  const play = (): void => {
    if (playing) return;
    playing = true;
    env.view.play();
  };
  env.fontsReady().then(play, play);
  env.later(config.fontWaitMs, play);

  const leave = (): void => {
    if (state !== 'showing') return;
    state = 'leaving';
    env.view.fadeOut(config.fadeOutMs);
    env.later(config.fadeOutMs, () => {
      state = 'gone';
      env.view.remove();
    });
  };
  // The safety net: an error or a start that hangs must not leave the screen up for good.
  env.later(config.maxShowMs + debug.holdMs, leave);

  let doneCalled = false;
  return {
    variant,
    state: () => state,
    done() {
      if (doneCalled || state !== 'showing') return;
      doneCalled = true;
      const wait = shownAt + Math.max(config.minShowMs, debug.holdMs) - env.now();
      env.later(Math.max(0, wait), leave);
    },
  };
}

/** The page half of the boot screen: the `#boot` element of index.html, localStorage, the app bridge. */
export function domBootEnv(win: Window): BootEnv {
  const doc = win.document;
  const root = doc.getElementById('boot');
  const storage = (): Storage | null => {
    try {
      return win.localStorage;
    } catch {
      return null;
    }
  };
  const view: BootView = {
    show(variant, lang, calm, safe) {
      if (!root) return;
      root.setAttribute('data-v', variant);
      root.setAttribute('lang', lang);
      if (calm) root.classList.add('calm');
      if (safe) {
        root.style.setProperty('--safe-top', safe.top + 'px');
        root.style.setProperty('--safe-bottom', safe.bottom + 'px');
      }
    },
    play() {
      root?.classList.add('go');
    },
    fadeOut(ms) {
      if (!root) return;
      root.style.transitionDuration = ms + 'ms';
      root.classList.add('out');
    },
    remove() {
      root?.parentNode?.removeChild(root);
    },
  };
  type Bridge = {
    nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
  };
  return {
    now: () => win.performance.now(),
    later: (ms, run) => {
      win.setTimeout(run, ms);
    },
    afterPaint: (run) => {
      win.requestAnimationFrame(() => win.requestAnimationFrame(run));
    },
    read: (key) => {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      try {
        storage()?.setItem(key, value);
      } catch {
        // A blocked storage only means the next launch shows the tower again.
      }
    },
    locales: win.navigator.languages ?? [win.navigator.language],
    systemReduce: !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    search: win.location.search,
    fontsReady: () => {
      const fonts = doc.fonts;
      if (!fonts) return Promise.resolve();
      return Promise.all([
        fonts.load('900 50px Nunito', 'Tippy Treats'),
        fonts.load('900 20px Nunito', 'Взбиваем'),
      ]);
    },
    view,
    hideSplash: (fadeMs) => {
      const bridge = (win as Window & { Capacitor?: Bridge }).Capacitor;
      try {
        bridge
          ?.nativePromise?.('SplashScreen', 'hide', { fadeOutDuration: fadeMs })
          .catch(() => undefined);
      } catch {
        // The game hides the splash again with its first screen (game/app/native-shell.ts).
      }
    },
  };
}
