import * as Phaser from 'phaser';
import './style.css';
import { BOOT } from './data/boot';
import { bindLogicalResize, createGameConfig } from './game/config';
import { FONT_FAMILY, FONT_WEIGHT } from './game/ui/fonts';
import { applySavedSettings } from './game/apply-settings';
import { detectLang, setLang } from './i18n';
import { gameState } from './state';
import { bindSaveFlush } from './state/page-lifecycle';
import { readDebugParams, withoutReset } from './util/debug-params';

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
  bindSaveFlush(gameState);
  applySavedSettings();
}

async function start(): Promise<void> {
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
  bootStage('game');
  const game = new Phaser.Game(createGameConfig(parent));
  bindLogicalResize(game, parent);
  bootStage('started');
  if (import.meta.env.DEV) {
    // Handle for browser automation and manual poking from the console.
    (window as Window & { tippyGame?: Phaser.Game }).tippyGame = game;
    // window.tippyIdleAudit(seconds): lists objects of the run screen that stand still for over 2 s.
    void import('./game/debug/idle-audit').then((audit) => audit.registerIdleAudit(game));
  }
}

void start();
