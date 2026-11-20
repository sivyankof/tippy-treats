import * as Phaser from 'phaser';
import './style.css';
import { APP_VERSION, BUILD_HASH, BUILD_TIME } from './data/app/app-info';
import { BOOT } from './data/app/boot';
import { formatBuildStamp } from './util/build-stamp';
import { bindLogicalResize, createGameConfig } from './game/app/config';
import { refreshTextsOnFontLoad } from './game/ui/common/font-refresh';
import { FONT_FAMILY, FONT_WEIGHT } from './game/ui/common/fonts';
import { applySavedSettings } from './game/app/apply-settings';
import { detectLang, setLang } from './i18n';
import { syncPurchases } from './game/economy/purchases';
import { gameState } from './state';
import { bindSaveFlush } from './state/page-lifecycle';
import { followEffectsLevelDensity } from './game/app/follow-density';
import { dropFramebufferHandlesOnLoss } from './game/app/lost-context-watch';
import { bindNativeShell } from './game/app/native-shell';
import { bindNotifSchedule } from './game/app/notif-schedule';
import { realNow } from './util/clock';
import { services } from './services';
import { beginPerfSession } from './game/perf/perf-session';
import { readDebugParams, readPerfParams, showsFpsMeter, withoutReset } from './util/debug-params';

// Sample covers both subsets so the Latin and Cyrillic font files are fetched up front.
const FONT_SAMPLE = 'Tippy Treats Башня 0123456789';

/** Dev builds report how far the start got (index.html shows it if the game does not start). */
function bootStage(stage: string): void {
  if (import.meta.env.DEV) (window as Window & { __bootStage?: string }).__bootStage = stage;
}

async function loadFonts(): Promise<void> {
  const weights = Object.values(FONT_WEIGHT);
  const loads = Promise.all(
    weights.map((weight) => document.fonts.load(`${weight} 48px ${FONT_FAMILY}`, FONT_SAMPLE)),
  );
  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), BOOT.fontWaitMs);
  });
  try {
    // The game stays playable with the fallback system font, so it never waits for long.
    if ((await Promise.race([loads, timeout])) === 'timeout') {
      console.warn(`Fonts not ready after ${BOOT.fontWaitMs} ms, starting with the fallback font`);
    }
  } catch (error) {
    console.warn('Font loading failed', error);
  }
}

/** Reads the save; a storage that fails or stalls never blocks the start (a new save is used, and a stalled one is never written). */
async function loadSave(): Promise<void> {
  try {
    const reset = readDebugParams().reset === true;
    const result = await gameState.load({ reset, timeoutMs: BOOT.saveWaitMs });
    if (result.status === 'loaded' && result.source !== 'primary')
      console.warn(`Save loaded from: ${result.source}`);
    // The reset is done: a reload (or a dev server full reload) must not wipe the save again.
    if (reset) window.history.replaceState(window.history.state, '', withoutReset(location.href));
  } catch (error) {
    console.warn('Save loading failed', error);
  }
  gameState.beginSession();
  bindSaveFlush(gameState);
  applySavedSettings();
  await syncPurchases();
}

async function start(): Promise<void> {
  // The first console line of a dev session: which build a tester is running.
  if (import.meta.env.DEV) {
    console.info(`Tippy Treats ${APP_VERSION} (${formatBuildStamp(BUILD_HASH, BUILD_TIME)})`);
  }
  const parent = document.getElementById('app');
  if (!parent) {
    throw new Error('Missing #app container');
  }
  bootStage('main');
  setLang(detectLang(navigator.languages));
  bootStage('save');
  await loadSave();
  bootStage('fonts');
  await loadFonts();
  if (import.meta.env.DEV) {
    // window.__tippyAudio: offline render and measurement of the sounds (docs/08-architecture.md, section 9).
    void import('./game/debug/audio-hook').then((hook) => hook.registerAudioHook());
  }
  // Written out (not `DEBUG_TOOLS`) so that the store build drops the soundboard module (see build-kind.ts).
  if (import.meta.env.DEV || import.meta.env.VITE_INTERNAL_BUILD === '1') {
    // `?soundboard=1`: the sound test page instead of the game.
    // The simulator trace of the sound test page opens it without a query (an app has no address bar).
    const traceBoard = import.meta.env.VITE_AUDIO_TRACE === 'soundboard';
    if (traceBoard || new URLSearchParams(window.location.search).get('soundboard') === '1') {
      const board = await import('./game/debug/soundboard');
      board.showSoundboard();
      if (traceBoard)
        void import('./game/debug/soundboard-trace').then((t) => t.runSoundboardTrace());
      bootStage('started');
      return;
    }
  }
  if (import.meta.env.VITE_AUDIO_TRACE === '1') {
    void import('./game/debug/audio-trace').then((trace) => trace.startAudioTrace());
  }
  // `?perf=1` (any build): an automatic benchmark run, kept out of the save (docs/08-architecture.md, section 9).
  const perf = readPerfParams();
  const perfDirector = perf ? await import('./game/perf/perf-director') : null;
  if (perf) beginPerfSession(perf);
  bootStage('game');
  const game = new Phaser.Game(createGameConfig(parent));
  dropFramebufferHandlesOnLoss(game);
  perfDirector?.startPerfDirector(game);
  // The benchmark's `&dpr=` sets its own cap, to compare the variants.
  if (perf?.densityCap === undefined) followEffectsLevelDensity(game);
  bindLogicalResize(game, parent);
  refreshTextsOnFontLoad(game);
  bindNativeShell(game, services.appShell, services.audio, gameState);
  // The debug test notification (menu button) joins the plan; the store build never loads it.
  const notifTest =
    import.meta.env.DEV || import.meta.env.VITE_INTERNAL_BUILD === '1'
      ? await import('./game/debug/notif-test')
      : null;
  bindNotifSchedule(
    services.appShell,
    services.notifications,
    gameState,
    realNow,
    notifTest?.notifTest.take,
  );
  bootStage('started');
  // Works in production builds too, unlike the other debug parameters.
  if (showsFpsMeter(window.location.search))
    void import('./game/debug/fps-meter').then((meter) => meter.showFpsMeter(game));
  if (import.meta.env.DEV) {
    // Handle for browser automation and manual poking from the console.
    (window as Window & { tippyGame?: Phaser.Game }).tippyGame = game;
    // window.tippyIdleAudit(seconds): lists objects of the run screen that stand still for over 2 s.
    void import('./game/debug/idle-audit').then((audit) => audit.registerIdleAudit(game));
    // Esc stands in for the Android back (game/app/back-stack.ts): the same handlers answer it.
    void import('./game/app/back-stack').then((back) =>
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !back.handleBack())
          console.info('[back] nothing took it: the app would go to the background');
      }),
    );
    // window.tippySoak: the long play-through of the leak check (scripts keep the harness).
    void import('./game/debug/soak-driver').then((soak) => soak.registerSoak(game));
    // window.tippyStore: the in-game half of `npm run store:shots` (docs/11-release-store.md, section 5).
    void import('./game/debug/store-stage').then((store) => store.registerStoreStage(game));
  }
}

void start();
