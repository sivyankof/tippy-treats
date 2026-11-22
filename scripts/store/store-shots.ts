/**
 * `npm run store:shots`: the screenshots of the store pages (docs/11-release-store.md, section 5).
 *
 *   npm run store:shots -- [--only cover,tap,...,feature,header,search,universal,iap,icon]
 *     [--platform ios|android] [--lang en|ru] [--variant a,b,c]
 *     [--out <dir>] [--assets <dir>] [--url <dev server>] [--playwright <dir>] [--check]
 *
 * Besides the screenshots it lays out the Google Play feature graphic and the App Store creative
 * assets (the product page header, the search results picture, the universal one).
 *
 * Starts its own vite (unless --url), opens the game in headless Chromium with the page clock
 * stopped (Playwright `clock`) and `Math.random` seeded, sets the save, moves the game frame by
 * frame until `window.tippyStore` says the moment of the shot is on screen, takes the frame in the
 * exact size and lays the plate, the caption and the big creatures over it on the compose page.
 * Every run gives the same pictures. `--check` only checks the files already in --out.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STORE_CLOCK,
  STORE_CREATIVE,
  STORE_CREATIVES,
  STORE_DEVICES,
  STORE_FEATURE,
  STORE_IAP_SHOT,
  STORE_ICON,
  STORE_LANGS,
  STORE_PLATFORMS,
  STORE_SHOTS,
  STORE_VARIANTS,
  type StoreCreative,
  type StoreLang,
  type StorePlatform,
  type StoreVariant,
  storeShotSize,
  variantMakes,
  type StoreShot,
  type StoreStage,
} from '../../src/data/debug/store-shots';
import { encodePng, readPngHeader, type PngColor } from './png';
import type {
  Composed,
  ComposeOverlay,
  CreativePart,
  CreativeResult,
  CreativeSpec,
  FeatureSpec,
  ReadablePart,
  ShotSpec,
} from './compose-page';
import { creativeCreatures } from './creative-layout';
import type { CreatureArtSpec } from '../../src/game/debug/store-stage';

const require = createRequire(import.meta.url);
const tools = require('../dev-tools.cjs') as typeof import('../dev-tools.cjs');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ASSETS = resolve(ROOT, '..', 'tippy-treats-store-assets');
const HERO_FILE = 'tippy-icon-hero-transparent.png';
const IOS_ICON_FILE = 'tippy-icon-ios-1024.png';
/** Browser locale of each language of the interface. */
const LOCALES: Readonly<Record<StoreLang, string>> = { en: 'en-US', ru: 'ru-RU' };
/** GPU flags of the game: without them the software GL drops triangles of rotated pictures (docs/08, section 9). */
const BROWSER_ARGS = ['--use-angle=d3d11', '--ignore-gpu-blocklist'];
/** The compose page draws on the CPU: a GPU canvas blurs the shadows a little differently each run. */
const COMPOSE_ARGS = ['--disable-gpu', '--disable-accelerated-2d-canvas'];
/** Real time to wait between looks while the page loads files (the game clock stands still meanwhile). */
const LOAD_POLL_MS = 30;
const PAGE_TIMEOUT_MS = 120_000;
/** A shot whose page reloads more often than this fails (a cold vite reloads once). */
const MAX_RESTARTS = 3;
/** Google Play takes screenshots up to 8 MB. */
const MAX_SHOT_BYTES = 8 * 1024 * 1024;
/**
 * Apple names no file size for the creative assets; the In-App Event media of the same page may
 * weigh 500 MB. This only catches a broken file.
 */
const MAX_CREATIVE_BYTES = 100 * 1024 * 1024;
/** Rows of an App Store picture read from the compose page in one call (about 5 MB of RGBA at 5244 px). */
const CREATIVE_ROWS_PER_CALL = 256;

// The few Playwright calls this script makes (Playwright is not a dependency of the project).
interface Page {
  goto(url: string, options?: { timeout?: number }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  screenshot(options: { type: 'png' }): Promise<Buffer>;
  on(event: 'pageerror', listener: (error: Error) => void): void;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
  clock: {
    install(options: { time: Date }): Promise<void>;
    pauseAt(time: Date): Promise<void>;
    runFor(ms: number): Promise<void>;
  };
}
interface Context {
  newPage(): Promise<Page>;
  addInitScript<A>(fn: (arg: A) => void, arg: A): Promise<void>;
  close(): Promise<void>;
}
interface Browser {
  newContext(options: Record<string, unknown>): Promise<Context>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(options: { args: string[] }): Promise<Browser> };
}

type StoreWindow = Window & {
  storeReseed?: () => void;
  tippyGame?: {
    isBooted: boolean;
    scene: {
      getScenes(
        active: boolean,
      ): Array<{ load?: { inflight: { size: number }; queue: { size: number } } }>;
    };
  };
  tippyStore?: {
    begin(id: string): void;
    status: string;
    creatureArt(spec: CreatureArtSpec): Promise<string>;
  };
  storeCompose?: {
    ready: Promise<void>;
    shot(spec: ShotSpec): Promise<Composed>;
    feature(spec: FeatureSpec): Promise<Composed>;
    creative(spec: CreativeSpec): Promise<CreativeResult>;
    compare(
      pictures: ReadonlyArray<{ label: string; image: string }>,
    ): Promise<{ width: number; height: number }>;
    rows(part: ReadablePart, from: number, count: number): string;
    icon(src: string, size: number): Promise<Composed>;
    saveText(lang: StoreLang): string;
  };
};

interface Options {
  only: Set<string> | null;
  platforms: StorePlatform[];
  langs: StoreLang[];
  /** The variants of the App Store pictures to make (`--variant b,c`; all by default). */
  variants: StoreVariant[];
  out: string;
  assets: string;
  url: string | null;
  playwright: string | null;
  check: boolean;
}

function readOptions(): Options {
  const { options } = tools.parseArgs(process.argv.slice(2), [
    'only',
    'platform',
    'lang',
    'variant',
    'out',
    'assets',
    'url',
    'playwright',
  ]);
  const text = (name: string): string | null => {
    const value = options[name];
    return typeof value === 'string' ? value : null;
  };
  const assets = resolve(text('assets') ?? DEFAULT_ASSETS);
  const variants = text('variant')?.split(',') ?? STORE_VARIANTS;
  const unknown = variants.filter((v) => !(STORE_VARIANTS as readonly string[]).includes(v));
  if (unknown.length > 0) throw new Error(`--variant: no variant ${unknown.join(', ')}`);
  const platform = text('platform');
  const lang = text('lang');
  return {
    only: text('only') ? new Set(text('only')!.split(',')) : null,
    platforms: STORE_PLATFORMS.filter((p) => platform === null || p === platform),
    langs: STORE_LANGS.filter((l) => lang === null || l === lang),
    variants: STORE_VARIANTS.filter((v) => variants.includes(v)),
    out: resolve(text('out') ?? join(assets, 'screenshots')),
    assets,
    url: text('url'),
    playwright: tools.findPlaywright(text('playwright') ?? undefined),
    check: options.check === true,
  };
}

const dataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString('base64')}`;

function writeRgba(
  path: string,
  width: number,
  height: number,
  rgba: Buffer,
  color: PngColor,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(width, height, rgba, color));
}

function write(path: string, composed: Composed, color: PngColor): void {
  writeRgba(path, composed.width, composed.height, Buffer.from(composed.rgba, 'base64'), color);
}

/** A page of the game in the size of `platform`, its clock stopped at the start, the save of `lang` in place. */
async function openGame(
  browser: Browser,
  base: string,
  platform: StorePlatform,
  lang: StoreLang,
  save: string,
  query: string,
) {
  const device = STORE_DEVICES[platform];
  const context = await browser.newContext({
    viewport: { width: device.cssWidth, height: device.cssHeight },
    deviceScaleFactor: device.density,
    isMobile: true,
    hasTouch: true,
    userAgent: device.userAgent,
    locale: LOCALES[lang],
    timezoneId: 'UTC',
  });
  await context.addInitScript(
    ({ seed, save }: { seed: number; save: string }) => {
      let state = seed >>> 0;
      Math.random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      // The boot may draw a different number of values (files come in their own order): the
      // shot starts the sequence over when its first frame is about to run.
      (window as StoreWindow).storeReseed = () => {
        state = seed >>> 0;
      };
      window.localStorage.setItem('save', save);
    },
    { seed: STORE_CLOCK.randomSeed, save },
  );
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  const start = new Date(`${STORE_CLOCK.start}Z`);
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1));
  const safe = `safe=${String(device.safeTop)},${String(device.safeBottom)}`;
  await page.goto(`${base}?${safe}${query ? `&${query}` : ''}`, { timeout: PAGE_TIMEOUT_MS });
  return { context, page, problems };
}

/**
 * True while a file is on its way or being decoded: the game clock waits, so the frames do not
 * depend on how fast the disk is. A loader between two batches waits for the next frame, so the
 * clock moves then.
 */
function loading(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = (window as StoreWindow).tippyGame;
    if (!game?.isBooted) return true;
    return game.scene
      .getScenes(false)
      .some((scene) => (scene.load?.inflight.size ?? 0) + (scene.load?.queue.size ?? 0) > 0);
  }, null);
}

async function waitReal(ms: number): Promise<void> {
  await new Promise((done) => setTimeout(done, ms));
}

/**
 * `look` on the page, again and again in real time, until it is true. A cold vite reloads a page
 * once it has bundled the dependencies the page asked for: a look that the reload cut off counts as false.
 */
async function until(page: Page, look: () => boolean, what: string): Promise<void> {
  for (let waited = 0; waited <= PAGE_TIMEOUT_MS; waited += LOAD_POLL_MS) {
    const yes = await page.evaluate(look, null).catch(() => false);
    if (yes) return;
    await waitReal(LOAD_POLL_MS);
  }
  throw new Error(`${what} did not start`);
}

/** Waits in real time while the page loads files; a page that keeps loading (or is gone) fails the shot. */
async function waitForFiles(page: Page, id: string): Promise<void> {
  for (let waited = 0; await loading(page).catch(() => true); waited += LOAD_POLL_MS) {
    if (waited > PAGE_TIMEOUT_MS) throw new Error(`${id}: the page kept loading (or crashed)`);
    await waitReal(LOAD_POLL_MS);
  }
}

/** Moves the game clock frame by frame until the shot's moment; the page stays on that frame. */
async function playToMoment(page: Page, id: string): Promise<void> {
  const begin = async (): Promise<void> => {
    await until(page, () => (window as StoreWindow).tippyStore !== undefined, 'the game');
    await page.evaluate((shot) => {
      const win = window as StoreWindow;
      win.storeReseed?.();
      win.tippyStore?.begin(shot);
    }, id);
  };
  await begin();
  let restarts = 0;
  for (let t = 0; t < STORE_CLOCK.maxGameMs; t += STORE_CLOCK.frameMs) {
    await waitForFiles(page, id);
    await page.clock.runFor(STORE_CLOCK.frameMs);
    const status = await page
      .evaluate(() => (window as StoreWindow).tippyStore?.status ?? 'none', null)
      .catch(() => 'none');
    if (status === 'ready') return;
    if (status.startsWith('failed')) throw new Error(`${id}: ${status}`);
    if (status === 'none') {
      // The page was reloaded (a cold vite): the shot starts over from the first frame.
      restarts += 1;
      if (restarts > MAX_RESTARTS) throw new Error(`${id}: the page kept reloading`);
      await begin();
      t = 0;
    }
  }
  throw new Error(
    `${id}: the moment did not come in ${String(STORE_CLOCK.maxGameMs)} ms of game time`,
  );
}

/** The raw frame of a shot and the pictures of its big creatures. */
async function capture(
  browser: Browser,
  base: string,
  compose: Page,
  platform: StorePlatform,
  lang: StoreLang,
  id: string,
  stage: StoreStage,
  arts: readonly CreatureArtSpec[],
): Promise<{ frame: Buffer; arts: string[] }> {
  const query = stage.kind === 'run' ? stage.query : '';
  const save = await compose.evaluate(
    (l) => (window as StoreWindow).storeCompose!.saveText(l),
    lang,
  );
  const { context, page, problems } = await openGame(browser, base, platform, lang, save, query);
  try {
    await playToMoment(page, id);
    const frame = await page.screenshot({ type: 'png' });
    const pictures: string[] = [];
    for (const art of arts) {
      pictures.push(
        await page.evaluate((spec) => (window as StoreWindow).tippyStore!.creatureArt(spec), art),
      );
    }
    if (problems.length > 0)
      throw new Error(`${id}: page errors: ${problems.slice(0, 3).join(' | ')}`);
    return { frame, arts: pictures };
  } finally {
    await context.close();
  }
}

/** The big creatures of a shot as the game draws them, and where they go. */
function overlaysOf(shot: StoreShot, platform: StorePlatform, hero: string) {
  const { width, height } = storeShotSize(platform);
  const arts: CreatureArtSpec[] = [];
  const places: Array<Omit<ComposeOverlay, 'image'> & { art: number | null }> = [];
  for (const overlay of shot.overlays) {
    const place = overlay.place[platform];
    if (!place) continue;
    const at = {
      x: place.x * width,
      y: place.y * height,
      width: place.width * width,
      angle: place.angle ?? 0,
    };
    if (overlay.kind === 'hero') {
      places.push({ ...at, art: null });
    } else {
      arts.push({
        creature: overlay.creature,
        level: overlay.level,
        grown: overlay.grown,
        face: overlay.face,
        widthPx: Math.round(at.width),
      });
      places.push({ ...at, art: arts.length - 1 });
    }
  }
  const resolveImages = (pictures: readonly string[]): ComposeOverlay[] =>
    places.map(({ art, ...at }) => ({ ...at, image: art === null ? hero : (pictures[art] ?? '') }));
  return { arts, resolveImages, width, height };
}

async function openCompose(
  browser: Browser,
  base: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 400, height: 300 } });
  const page = await context.newPage();
  await page.goto(`${base}scripts/store/compose.html`, { timeout: PAGE_TIMEOUT_MS });
  await until(page, () => (window as StoreWindow).storeCompose !== undefined, 'the compose page');
  await page.evaluate(() => (window as StoreWindow).storeCompose!.ready, null);
  return { page, close: () => context.close() };
}

const wantedBy =
  (options: Options) =>
  (id: string): boolean =>
    options.only === null || options.only.has(id);

/** The feature graphic (`--only feature`) belongs to the Android page; its frame is shot once, its text per language. */
function makesFeature(options: Options): boolean {
  return wantedBy(options)('feature') && options.platforms.includes('android');
}

/** The App Store creative assets the options ask for (`--only header,search,universal`, iOS). */
function creativesWanted(options: Options): StoreCreative[] {
  if (!options.platforms.includes('ios')) return [];
  return STORE_CREATIVES.filter((c) => wantedBy(options)(c.id));
}

/** The files of an App Store picture in a variant: the picture, its safe area alone, the whole picture made small. */
const CREATIVE_PARTS: ReadonlyArray<{ part: CreativePart; suffix: string }> = [
  { part: 'main', suffix: '' },
  { part: 'safe', suffix: '-safe' },
  { part: 'full', suffix: '-full' },
];

/** The comparison sheet of variant C: B's whole picture over C's (`-full` of each). */
const COMPARED: readonly StoreVariant[] = ['b', 'c'];
const compareFile = (creative: StoreCreative, lang: StoreLang): string =>
  join(
    STORE_CREATIVE.folder,
    STORE_CREATIVE.variantsFolder,
    'c',
    `compare-${creative.id}-${lang}.png`,
  );

/** Whether a run makes the comparison sheet of `creative` (it makes C's picture of it). */
const makesCompare = (options: Options, creative: StoreCreative): boolean =>
  options.variants.includes('c') && variantMakes('c', creative.id);

const creativeFile = (
  creative: StoreCreative,
  variant: StoreVariant,
  lang: StoreLang,
  suffix: string,
): string =>
  join(
    STORE_CREATIVE.folder,
    STORE_CREATIVE.variantsFolder,
    variant,
    `${creative.id}-${lang}${suffix}.png`,
  );

/** The tower creatures of the poster, drawn by the game at the width a picture lays them out at. */
function posterArts(width: number): CreatureArtSpec[] {
  return STORE_FEATURE.tower.creatures.map((c) => ({
    ...c,
    widthPx: Math.round(STORE_FEATURE.tower.width * width),
  }));
}

/**
 * The App Store creative assets, every variant asked for, every language. The game draws every creature of
 * every picture once (at the width the picture lays it out at); the compose page lays out and
 * draws the rest, and the picture and its two check pictures are read back row by row.
 */
async function shootCreatives(
  options: Options,
  creatives: readonly StoreCreative[],
  browser: Browser,
  compose: Page,
  base: string,
  hero: string,
): Promise<void> {
  // The comparison sheets take B's whole pictures from the output folder: missing ones fail the
  // run before any picture is drawn, unless this run makes B itself first.
  if (!options.variants.includes('b')) {
    for (const c of creatives.filter((x) => makesCompare(options, x))) {
      for (const lang of options.langs) {
        const file = join(options.out, creativeFile(c, 'b', lang, '-full'));
        if (!existsSync(file)) throw new Error(`no ${file} for the comparison sheet`);
      }
    }
  }
  const plans = options.variants.flatMap((variant) =>
    creatives
      .filter((c) => variantMakes(variant, c.id))
      .map((c) => ({ c, variant, creatures: creativeCreatures(c, variant) })),
  );
  const arts: CreatureArtSpec[] = plans.flatMap((p) =>
    p.creatures.map((x) => ({
      creature: x.creature,
      level: x.level,
      grown: x.grown,
      face: x.face,
      widthPx: x.artWidth,
    })),
  );
  // Any moment of the game will do: only its pictures of the creatures are used.
  const raw = await capture(
    browser,
    base,
    compose,
    'ios',
    'en',
    'feature',
    STORE_FEATURE.background.stage,
    arts,
  );
  for (const lang of options.langs) {
    let next = 0;
    for (const { c, variant, creatures } of plans) {
      const pictures = raw.arts.slice(next, next + creatures.length);
      next += creatures.length;
      const spec: CreativeSpec = { id: c.id, variant, lang, hero, creatures: pictures };
      const result = await compose.evaluate(
        (s) => (window as StoreWindow).storeCompose!.creative(s),
        spec,
      );
      for (const { part, suffix } of CREATIVE_PARTS) {
        const file = join(options.out, creativeFile(c, variant, lang, suffix));
        await readPart(compose, part, result.parts[part], file);
      }
      const b = result.bounds;
      const at = [b.x, b.y, b.width, b.height].map((v) => String(Math.round(v))).join(',');
      const lines = (fit: CreativeResult['title']) => fit.lines.join(' / ');
      console.log(
        `${creativeFile(c, variant, lang, '')}  ${lines(result.title)} | ${lines(result.subtitle)}  key ${at}  title ${result.title.size.toFixed(0)} px`,
      );
    }
    for (const c of creatives.filter((x) => makesCompare(options, x))) {
      await shootCompare(options, compose, c, lang);
    }
  }
}

/** Reads a canvas of the compose page row by row into a PNG file. */
async function readPart(
  compose: Page,
  part: ReadablePart,
  size: { width: number; height: number },
  file: string,
): Promise<void> {
  const { width, height } = size;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += CREATIVE_ROWS_PER_CALL) {
    const chunk = await compose.evaluate(
      ({ which, from, count }) => (window as StoreWindow).storeCompose!.rows(which, from, count),
      { which: part, from: y, count: CREATIVE_ROWS_PER_CALL },
    );
    Buffer.from(chunk, 'base64').copy(rgba, y * width * 4);
  }
  writeRgba(file, width, height, rgba, 'rgb');
}

/** B's whole picture over C's, from the `-full` files in the output folder. */
async function shootCompare(
  options: Options,
  compose: Page,
  c: StoreCreative,
  lang: StoreLang,
): Promise<void> {
  const pictures = COMPARED.map((variant) => {
    const file = join(options.out, creativeFile(c, variant, lang, '-full'));
    if (!existsSync(file)) throw new Error(`no ${file} to compare with`);
    return { label: variant.toUpperCase(), image: dataUrl(readFileSync(file)) };
  });
  const size = await compose.evaluate(
    (p) => (window as StoreWindow).storeCompose!.compare(p),
    pictures,
  );
  await readPart(compose, 'compare', size, join(options.out, compareFile(c, lang)));
  console.log(compareFile(c, lang));
}

async function shoot(
  options: Options,
  browser: Browser,
  composer: Browser,
  base: string,
): Promise<void> {
  const hero = dataUrl(readFileSync(join(options.assets, HERO_FILE)));
  const compose = await openCompose(composer, base);
  const wanted = wantedBy(options);
  try {
    for (const platform of options.platforms) {
      for (const lang of options.langs) {
        for (const shot of STORE_SHOTS.filter((s) => wanted(s.id))) {
          const plan = overlaysOf(shot, platform, hero);
          const raw = await capture(
            browser,
            base,
            compose.page,
            platform,
            lang,
            shot.id,
            shot.stage,
            plan.arts,
          );
          const spec: ShotSpec = {
            frame: dataUrl(raw.frame),
            width: plan.width,
            height: plan.height,
            caption: shot.caption[lang],
            plateHeight: STORE_DEVICES[platform].plateHeight + (shot.plateGrow?.[platform] ?? 0),
            overlays: plan.resolveImages(raw.arts),
          };
          const composed = await compose.page.evaluate(
            (s) => (window as StoreWindow).storeCompose!.shot(s),
            spec,
          );
          write(
            join(options.out, STORE_DEVICES[platform].folder, lang, `${shot.file}.png`),
            composed,
            'rgb',
          );
          console.log(
            `${STORE_DEVICES[platform].folder}/${lang}/${shot.file}.png  ${composed.fit?.lines.join(' / ') ?? ''}`,
          );
        }
      }
    }
    if (makesFeature(options)) {
      const bg = STORE_FEATURE.background;
      const towerArts = posterArts(storeShotSize(bg.platform).width);
      for (const lang of options.langs) {
        // Shot per language: a floating word of the game may fall into the band.
        const raw = await capture(
          browser,
          base,
          compose.page,
          bg.platform,
          lang,
          'feature',
          bg.stage,
          towerArts,
        );
        const featureSpec: FeatureSpec = {
          frame: dataUrl(raw.frame),
          hero,
          tower: raw.arts,
          lang,
        };
        const graphic = await compose.page.evaluate(
          (s) => (window as StoreWindow).storeCompose!.feature(s),
          featureSpec,
        );
        write(join(options.out, 'android', `feature-graphic-${lang}.png`), graphic, 'rgb');
        console.log(`android/feature-graphic-${lang}.png`);
      }
    }
    const creatives = creativesWanted(options);
    if (creatives.length > 0) {
      await shootCreatives(options, creatives, browser, compose.page, base, hero);
    }
    if (wanted('iap')) {
      const iap = STORE_IAP_SHOT;
      const raw = await capture(
        browser,
        base,
        compose.page,
        iap.platform,
        iap.lang,
        'iap',
        iap.stage,
        [],
      );
      const spec: ShotSpec = {
        frame: dataUrl(raw.frame),
        ...storeShotSize(iap.platform),
        caption: null,
        plateHeight: 0,
        overlays: [],
      };
      const composed = await compose.page.evaluate(
        (s) => (window as StoreWindow).storeCompose!.shot(s),
        spec,
      );
      write(join(options.out, 'iap-review', `${iap.file}.png`), composed, 'rgb');
      console.log(`iap-review/${iap.file}.png`);
    }
    if (wanted('icon')) {
      const src = dataUrl(readFileSync(join(options.assets, IOS_ICON_FILE)));
      const composed = await compose.page.evaluate(
        ({ s, size }) => (window as StoreWindow).storeCompose!.icon(s, size),
        { s: src, size: STORE_ICON.size },
      );
      write(join(options.out, 'android', `icon-${String(STORE_ICON.size)}.png`), composed, 'rgba');
      console.log(`android/icon-${String(STORE_ICON.size)}.png`);
    }
  } finally {
    await compose.close();
  }
}

async function make(options: Options): Promise<void> {
  if (!options.playwright)
    throw new Error('needs PLAYWRIGHT_PATH or --playwright <playwright package dir>');
  console.log(`store:shots: Playwright ${options.playwright}`);
  const playwright = require(options.playwright) as Playwright;
  const server = options.url ? { url: options.url, stop: () => {} } : await tools.startVite();
  try {
    const base = server.url.endsWith('/') ? server.url : `${server.url}/`;
    const browser = await playwright.chromium.launch({ args: BROWSER_ARGS });
    try {
      const composer = await playwright.chromium.launch({ args: COMPOSE_ARGS });
      try {
        await shoot(options, browser, composer, base);
      } finally {
        await composer.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.stop();
  }
}

type CheckRow = [file: string, width: number, height: number, color: PngColor, maxBytes: number];

/** The files the options ask for: every one when nothing narrows the run. */
function expectedFiles(options: Options): CheckRow[] {
  const wanted = wantedBy(options);
  const rows: CheckRow[] = [];
  for (const platform of options.platforms) {
    const { width, height } = storeShotSize(platform);
    for (const lang of options.langs) {
      for (const shot of STORE_SHOTS.filter((s) => wanted(s.id))) {
        rows.push([
          join(STORE_DEVICES[platform].folder, lang, `${shot.file}.png`),
          width,
          height,
          'rgb',
          MAX_SHOT_BYTES,
        ]);
      }
    }
  }
  if (makesFeature(options)) {
    for (const lang of options.langs) {
      const file = join('android', `feature-graphic-${lang}.png`);
      rows.push([file, STORE_FEATURE.width, STORE_FEATURE.height, 'rgb', MAX_SHOT_BYTES]);
    }
  }
  const preview = (c: StoreCreative) => ({
    main: { width: c.width, height: c.height },
    safe: { width: c.safe.width, height: c.safe.height },
    full: {
      width: STORE_CREATIVE.previewWidth,
      height: Math.round((STORE_CREATIVE.previewWidth * c.height) / c.width),
    },
  });
  for (const variant of options.variants) {
    for (const c of creativesWanted(options).filter((x) => variantMakes(variant, x.id))) {
      for (const lang of options.langs) {
        for (const { part, suffix } of CREATIVE_PARTS) {
          const { width, height } = preview(c)[part];
          const file = creativeFile(c, variant, lang, suffix);
          rows.push([file, width, height, 'rgb', MAX_CREATIVE_BYTES]);
        }
      }
    }
  }
  for (const c of creativesWanted(options).filter((x) => makesCompare(options, x))) {
    const height = COMPARED.length * (STORE_CREATIVE.compare.band + preview(c).full.height);
    for (const lang of options.langs) {
      rows.push([
        compareFile(c, lang),
        STORE_CREATIVE.previewWidth,
        height,
        'rgb',
        MAX_CREATIVE_BYTES,
      ]);
    }
  }
  if (wanted('icon')) {
    const file = join('android', `icon-${String(STORE_ICON.size)}.png`);
    rows.push([file, STORE_ICON.size, STORE_ICON.size, 'rgba', STORE_ICON.maxBytes]);
  }
  if (wanted('iap')) {
    const { width, height } = storeShotSize(STORE_IAP_SHOT.platform);
    rows.push([
      join('iap-review', `${STORE_IAP_SHOT.file}.png`),
      width,
      height,
      'rgb',
      MAX_SHOT_BYTES,
    ]);
  }
  return rows;
}

/** The files the run asked for, with their size, colour type and bytes checked; returns the number of problems. */
function check(options: Options): number {
  const rows = expectedFiles(options);
  let problems = 0;
  for (const [file, width, height, color, maxBytes] of rows) {
    const path = join(options.out, file);
    if (!existsSync(path)) {
      console.log(`MISSING ${file}`);
      problems++;
      continue;
    }
    const header = readPngHeader(readFileSync(path));
    const bytes = statSync(path).size;
    const colorType = color === 'rgb' ? 2 : 6;
    const ok =
      header !== null &&
      header.width === width &&
      header.height === height &&
      header.colorType === colorType &&
      bytes <= maxBytes;
    if (!ok) problems++;
    const size = header ? `${String(header.width)}x${String(header.height)}` : 'not a PNG';
    console.log(
      `${ok ? 'ok  ' : 'BAD '} ${file}  ${size}  ${color}  ${(bytes / 1024).toFixed(0)} KB`,
    );
  }
  console.log(
    `store:shots check: ${problems === 0 ? 'ok' : `${String(problems)} problems`}, ${String(rows.length)} files`,
  );
  return problems;
}

async function main(): Promise<void> {
  const options = readOptions();
  if (!options.check) await make(options);
  if (check(options) > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
