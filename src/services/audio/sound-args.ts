import type { Rarity } from '../../data/rarity';

/**
 * Every sound id and the arguments its call takes (a tuple; `[]` for a sound without any).
 * Adding a sound: add its id here, its entry to `SOUND_BOOK` (sound-book.ts) and its texts
 * `soundboard.sound.<id>` to both language files. `play('perfect', 3)` type-checks, `play('coin', 3)` does not.
 */
export interface SoundArgs {
  drop: [];
  /** `comboStep` is 1 for the first perfect in a row. */
  perfect: [comboStep: number];
  bite: [];
  coin: [];
  berry: [];
  ability: [rarity: Rarity];
  rainbowChime: [];
  rainbowJoke: [];
  cloudPuff: [];
  shieldPop: [];
  sneeze: [];
  miss: [];
  /** `index` is the position in the series (0 = first). */
  collapseThud: [index: number];
  record: [];
  recordBlip: [];
  click: [];
  lickSlurp: [];
  lickSlurpLong: [];
  lickSmack: [];
  lickHum: [];
  guestSplat: [];
  guestPeel: [];
  guestBuzz: [];
  guestGiggle: [];
  topperHop: [];
  /** `pitch` is a multiplier (1 = base pitch). */
  squeak: [pitch: number];
}

export type SoundId = keyof SoundArgs;
