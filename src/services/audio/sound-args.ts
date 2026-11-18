import type { Rarity } from '../../data/rarity';
import type { SquashKind } from '../../data/topper-squash';
import type { BedKind } from '../../data/weather-bed';

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
  // Sounds of sessions 3-5e (session 6, theme B), `data/sfx-life.ts`.
  cutStretch: [];
  cutStrandSnap: [];
  cutDrip: [];
  cutPanic: [];
  topperSquash: [kind: SquashKind];
  lickSlurpJuice: [];
  snowPuff: [];
  /** `muffled` is thunder heard through glass (the window of the Kitchen and the Showcase). */
  thunder: [muffled: boolean];
  /** `weak` is the weaker scare behind the glass of the Showcase. */
  startleOh: [weak: boolean];
  yawn: [];
  zoneChange: [];
  lapChange: [];
  /** `urgent` is the last two seconds of the countdown: higher and a little louder. */
  countdownTick: [urgent: boolean];
  purchase: [];
  /** A weather bed for a few seconds (the soundboard and the offline render; the game uses `setBed`). */
  weatherBed: [kind: BedKind];
}

export type SoundId = keyof SoundArgs;
