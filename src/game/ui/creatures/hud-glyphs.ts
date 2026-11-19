import type * as Phaser from 'phaser';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { getLang, setLang, type Lang } from '../../../i18n';
import { hudGlyphStyle, prepareGlyphs } from '../common/glyph-text';
import { numberGlyphTexts } from '../common/number-glyphs';
import { nextLabelGlyphTexts } from './next-creature-label';

/** The look of the counter of an effect badge. */
export const COUNTER_GLYPH_STYLE = hudGlyphStyle(
  HUD_LAYOUT.badgeCounterFont,
  HUD_LAYOUT.badgeCounterStroke,
);
/** The look of the next-creature label. */
export const NEXT_LABEL_GLYPH_STYLE = hudGlyphStyle(HUD_LAYOUT.nextFont, HUD_LAYOUT.nextStroke);

const BOTH_LANGS: readonly Lang[] = ['ru', 'en'];

/** Bakes the glyphs of the badge counters and of the next-creature label in both languages (for the art sheet). */
export function bakeHudGlyphs(scene: Phaser.Scene): void {
  const lang = getLang();
  for (const l of BOTH_LANGS) {
    setLang(l);
    prepareGlyphs(scene, COUNTER_GLYPH_STYLE, numberGlyphTexts());
    prepareGlyphs(scene, NEXT_LABEL_GLYPH_STYLE, nextLabelGlyphTexts());
  }
  setLang(lang);
}
