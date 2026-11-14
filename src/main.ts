import * as Phaser from 'phaser';
import './style.css';
import { bindLogicalResize, createGameConfig } from './game/config';
import { FONT_FAMILY, FONT_WEIGHT } from './game/ui/fonts';
import { detectLang, setLang } from './i18n';

// Sample covers both subsets so the Latin and Cyrillic font files are fetched up front.
const FONT_SAMPLE = 'Tippy Treats Башня 0123456789';

async function loadFonts(): Promise<void> {
  const weights = Object.values(FONT_WEIGHT);
  try {
    await Promise.all(
      weights.map((weight) => document.fonts.load(`${weight} 48px ${FONT_FAMILY}`, FONT_SAMPLE)),
    );
  } catch (error) {
    // The game stays playable with the fallback system font.
    console.warn('Font loading failed', error);
  }
}

async function start(): Promise<void> {
  const parent = document.getElementById('app');
  if (!parent) {
    throw new Error('Missing #app container');
  }
  setLang(detectLang(navigator.languages));
  await loadFonts();
  const game = new Phaser.Game(createGameConfig(parent));
  bindLogicalResize(game, parent);
  if (import.meta.env.DEV) {
    // Handle for browser automation and manual poking from the console.
    (window as Window & { tippyGame?: Phaser.Game }).tippyGame = game;
    // window.tippyIdleAudit(seconds): lists objects of the run screen that stand still for over 2 s.
    void import('./game/debug/idle-audit').then((audit) => audit.registerIdleAudit(game));
  }
}

void start();
