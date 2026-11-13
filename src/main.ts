import * as Phaser from 'phaser';
import './style.css';
import { bindLogicalResize, createGameConfig, FONT_FAMILY, FONT_WEIGHT } from './game/config';

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
  await loadFonts();
  const game = new Phaser.Game(createGameConfig(parent));
  bindLogicalResize(game, parent);
}

void start();
