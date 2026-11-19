/**
 * Level pass of session 6: a trim in dB per sound id, applied to every note of the sound by the
 * sound player (`SoundPlayer`). The aim, measured offline (`levels.ts`, RMS of the sounding part):
 * the sounds of one group sit within 6 dB of each other, in a window of about -30..-25.5 dBFS. The sfx bus compressor squeezes loud sounds, so a trim of a loud sound moves it by less than its dB; the numbers were found by measuring, not by arithmetic (`.playwright-mcp/session6/d`).
 * A sound that is not listed plays as its recipe says. The weather beds are trimmed in
 * `weather-bed.ts` instead (they are not played through the player).
 *
 * The windows are kept by design with one exception per kind: a far collapse (`collapseThud`
 * with a high index) fades with distance, and the rarity ladder of `ability` spans 6.8 dB.
 */
export const SOUND_TRIM_DB: Readonly<Record<string, number>> = {
  perfect: -5.5,
  bite: 9,
  miss: -10.5,
  collapseThud: 6,
  cutStretch: 2,
  cutStrandSnap: 10.5,
  cutPanic: 5,
  topperHop: 2,
  topperSquash: 8,
  thunder: -3,
  startleOh: 6.5,
  snowPuff: 13.5,
  squeak: 2,
  sneeze: 4.5,
  ability: -3.5,
  rainbowJoke: 4.5,
  cloudPuff: 22,
  lickSmack: 7.5,
  lickHum: -0.5,
  lickSlurpJuice: 7.5,
  guestBuzz: 7,
  guestGiggle: 5.5,
  click: 10.5,
  countdownTick: 14,
  berry: -2.5,
  purchase: -5.5,
  record: -3.5,
  rainbowChime: 3,
  shieldPop: 3,
  yawn: 2.5,
  lickSlurp: 2.5,
};
