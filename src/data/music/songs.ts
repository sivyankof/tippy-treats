import { BOX } from './box';
import { RUN } from './run';
import type { Song } from './song';
import { WALTZ } from './waltz';

/**
 * The tunes on offer (docs/06-art-animation-audio.md, section 7, "Музыка"). Each variant lives in
 * its own file and nothing else reads its contents: once the owner has chosen, the other two are
 * removed by deleting their files and their lines here.
 */
export const SONGS = {
  /** "Шкатулка": music box lullaby. */
  a: BOX,
  /** "Вальс кондитерской": bakery waltz. */
  b: WALTZ,
  /** "Бодрая": upbeat run. */
  c: RUN,
} as const satisfies Record<string, Song>;

export type MusicVariant = keyof typeof SONGS;

export const MUSIC_VARIANTS = Object.keys(SONGS) as MusicVariant[];

/**
 * The tune the game plays unless `?music=` picks another: the bakery waltz. It fits the sweets
 * theme, its middle tempo suits both the menu and a run, and its timbres (a soft square lead,
 * bass, reeds) differ from the combo bell, so the perfect-drop bells stay easy to hear; the music
 * box shares the bells' timbre and register, the run tune tires sooner over a long session.
 */
export const DEFAULT_MUSIC_VARIANT: MusicVariant = 'b';

/** The tune `?music=` asks for (`a`, `b` or `c`); anything else gives the default. */
export function musicVariantOf(raw: string | null | undefined): MusicVariant {
  return MUSIC_VARIANTS.find((variant) => variant === raw) ?? DEFAULT_MUSIC_VARIANT;
}
