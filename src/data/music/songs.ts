import { EVENING } from './evening';
import { KITCHEN } from './kitchen';
import { RAIN } from './rain';
import type { Song } from './song';

/**
 * The tunes on offer (docs/06-art-animation-audio.md, section 7, "Музыка"): three calm lofi
 * tunes, each in its own file; nothing else reads their contents.
 */
export const SONGS = {
  /** «Тёплая кухня»: C major, 76 bpm. */
  a: KITCHEN,
  /** «Дождь за окном»: A minor, 72 bpm. */
  b: RAIN,
  /** «Вечер»: F major, 70 bpm. */
  c: EVENING,
} as const satisfies Record<string, Song>;

export type MusicVariant = keyof typeof SONGS;

export const MUSIC_VARIANTS = Object.keys(SONGS) as MusicVariant[];

/**
 * The tune the game plays unless `?music=` picks another: «Дождь за окном», the calmest of the
 * three. It plays the fewest notes per minute (one long chord per bar, offbeat hats, a melody
 * that leaves half its bars empty), its chords change every two bars instead of every bar, and
 * none of its chords pulls towards a resolution (its "V" is a sus chord); «Тёплая кухня» is
 * brighter and busier, «Вечер» moves through ii-V turns that ask to be followed.
 */
export const DEFAULT_MUSIC_VARIANT: MusicVariant = 'b';

/** The tune `?music=` asks for (`a`, `b` or `c`); anything else gives the default. */
export function musicVariantOf(raw: string | null | undefined): MusicVariant {
  return MUSIC_VARIANTS.find((variant) => variant === raw) ?? DEFAULT_MUSIC_VARIANT;
}

/**
 * The file fallback (docs/06, section 7): a variant listed here plays the named file from
 * `assets/music/` in a loop instead of the synthesizer, through the same music bus, switches
 * and duck. Empty: every tune is synthesized. Each file goes into `assets/LICENSES.md`.
 */
export const MUSIC_FILES: Partial<Record<MusicVariant, string>> = {};
