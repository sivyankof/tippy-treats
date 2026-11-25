import { describe, expect, it } from 'vitest';
import { BOOT_SCREEN } from '../src/data/app/boot-screen';
import en from '../src/i18n/en.json';
import ru from '../src/i18n/ru.json';
import type { BootConfig } from '../src/util/boot/boot-screen';
import { bootPhrasesOf, bootScript, injectBoot, phrasesHtml } from './boot-screen-html';
import { nodeFs } from './node-env';

const read = (path: string): string => nodeFs().readFileSync(path, 'utf8');

const CONFIG: BootConfig = {
  storageKey: BOOT_SCREEN.storageKey,
  minShowMs: BOOT_SCREEN.minShowMs,
  maxShowMs: 8000,
  fadeOutMs: BOOT_SCREEN.fadeOutMs,
  fontWaitMs: BOOT_SCREEN.fontWaitMs,
  splashFadeMs: BOOT_SCREEN.splashFadeMs,
  debug: false,
};

/** Just enough of a page for the inline script: the #boot element, storage, timers, the app bridge. */
function fakeWindow(stored: string | null) {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const store = new Map<string, string>();
  if (stored !== null) store.set(CONFIG.storageKey, stored);
  const splash: object[] = [];
  const root = {
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    classList: { add: (name: string) => classes.add(name) },
    style: { setProperty: () => undefined, transitionDuration: '' },
    parentNode: null,
  };
  const win = {
    document: { getElementById: (id: string) => (id === 'boot' ? root : null) },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    performance: { now: () => 0 },
    setTimeout: () => 0,
    requestAnimationFrame: (run: () => void) => run(),
    navigator: { languages: ['en-US'], language: 'en-US' },
    matchMedia: () => ({ matches: false }),
    location: { search: '' },
    Capacitor: {
      nativePromise: (plugin: string, method: string, options: object) => {
        splash.push({ plugin, method, options });
        return Promise.resolve();
      },
    },
  } as Record<string, unknown>;
  return { win, attrs, classes, store, splash };
}

describe('boot screen in index.html', () => {
  it('runs as a plain script before the modules and counts the launch', async () => {
    const script = await bootScript(read('src/util/boot/boot-screen.ts'), CONFIG);
    expect(script).not.toMatch(/\bexport\b|\bimport\b/);
    const page = fakeWindow('{"launches":1}');
    new Function('window', 'document', script)(page.win, page.win.document);
    expect(page.attrs.get('data-v')).toBe('oven');
    expect(page.attrs.get('lang')).toBe('en');
    expect(JSON.parse(page.store.get(CONFIG.storageKey) ?? '{}').launches).toBe(2);
    expect(page.splash).toEqual([
      { plugin: 'SplashScreen', method: 'hide', options: { fadeOutDuration: CONFIG.splashFadeMs } },
    ]);
    expect(typeof (page.win.__tippyBoot as { done: unknown }).done).toBe('function');
  });

  it('takes the screen away when the script itself fails', async () => {
    const script = await bootScript('throw new Error("broken");', CONFIG);
    let removed = false;
    const boot = { parentNode: { removeChild: () => (removed = true) } };
    const doc = { getElementById: () => boot };
    new Function('window', 'document', script)({ document: doc }, doc);
    expect(removed).toBe(true);
  });

  it('puts both languages of the phrases of each picture into the page', () => {
    const phrases = bootPhrasesOf({ ru, en });
    expect(phrases.ru.tower[0]).toBe('Взбиваем крем…');
    expect(phrases.en.oven).toHaveLength(4);
    const html = phrasesHtml({ ...phrases, en: { ...phrases.en, tower: ['A & <b>'] } }, 'tower');
    expect(html).toContain('<div class="phrases" data-lang="ru"><span>Взбиваем крем…</span>');
    expect(html).toContain('<span>A &amp; &lt;b&gt;</span>');
  });

  it('fills every mark of index.html', async () => {
    const script = await bootScript(read('src/util/boot/boot-screen.ts'), CONFIG);
    for (const compact of [false, true]) {
      const html = injectBoot(read('index.html'), script, bootPhrasesOf({ ru, en }), compact);
      expect(html).not.toContain('<!-- boot-');
      expect(html).toContain('Разогреваем печь…');
      expect(html).toContain('Whipping the cream…');
      expect(html.indexOf('<div id="boot"')).toBeLessThan(html.indexOf('<div id="app">'));
    }
  });
});
