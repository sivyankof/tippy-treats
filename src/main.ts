import * as Phaser from 'phaser';
import './style.css';
import { BOOT } from './data/boot';
import { bindLogicalResize, createGameConfig } from './game/config';
import { FONT_FAMILY, FONT_WEIGHT } from './game/ui/fonts';
import { detectLang, setLang } from './i18n';

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

async function start(): Promise<void> {
  const parent = document.getElementById('app');
  if (!parent) {
    throw new Error('Missing #app container');
  }
  bootStage('main');
  setLang(detectLang(navigator.languages));
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
