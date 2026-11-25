import type * as Phaser from 'phaser';
import { HUD_LAYOUT, PAUSE } from '../../../data/run/hud-layout';
import { ANIM } from '../../../data/common/anim';
import { TUTORIAL_ANIM } from '../../../data/tutorial/tutorial-anim';
import { getLang, setLang, t, type Lang } from '../../../i18n';
import { prepareGlyphs, volumeGlyphStyle, type GlyphStyle } from '../common/glyph-text';
import { numberGlyphTexts } from '../common/number-glyphs';

/** Digits of the height number in the run HUD: white face, volume look. */
export const HEIGHT_GLYPH_STYLE = volumeGlyphStyle(HUD_LAYOUT.heightFont, {
  face: 'white',
  refText: '0123456789',
});

/** The digits the countdown after a pause shows, as one string ("321"). */
export const COUNTDOWN_DIGITS = Array.from({ length: ANIM.hud.countdownSteps }, (_, i) =>
  String(ANIM.hud.countdownSteps - i),
).join('');

/** The 3-2-1 after a pause: gold face; the band is measured on the digits it shows. */
export const COUNTDOWN_GLYPH_STYLE = volumeGlyphStyle(PAUSE.countdownFont, {
  face: 'gold',
  refText: COUNTDOWN_DIGITS,
});

/** The tutorial tap hint in the current language: white face, the band measured on its own letters. */
export function tapGlyphStyle(text: string): GlyphStyle {
  return volumeGlyphStyle(TUTORIAL_ANIM.tap.fontSize, { face: 'white', refText: text });
}

const BOTH_LANGS: readonly Lang[] = ['ru', 'en'];

/** Bakes every volume text of the run in both languages (for the art sheet). */
export function bakeRunVolumeGlyphs(scene: Phaser.Scene): void {
  const lang = getLang();
  prepareGlyphs(scene, COUNTDOWN_GLYPH_STYLE, [COUNTDOWN_DIGITS]);
  for (const l of BOTH_LANGS) {
    setLang(l);
    prepareGlyphs(scene, HEIGHT_GLYPH_STYLE, numberGlyphTexts());
    const hint = t('tutorial.tap');
    prepareGlyphs(scene, tapGlyphStyle(hint), [hint]);
  }
  setLang(lang);
}
