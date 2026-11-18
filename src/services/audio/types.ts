import type { Rarity } from '../../data/rarity';
import type { BedKind } from '../../data/weather-bed';
import type { MusicAsk } from '../../data/music';
import type { MusicControl, MusicPlayerState } from './music-control';
import type { DuckReason } from './mixer-math';
import type { SoundArgs, SoundId } from './sound-args';

/** Why sound is held back; the audio runs again only when none is left. `silent` is the device's silent mode. */
export type AudioSuspendReason = 'app' | 'ad' | 'silent';

/** Diagnostics for the leak check and the perf run (dev tools only). */
export interface AudioDebugStats {
  /** Audio nodes created and not yet released (sounds in flight, music voices). */
  liveNodes: number;
  /** Of `liveNodes`, those of the music (its chain and notes: they move with the beat). */
  musicNodes: number;
  /** `AudioContext.state`, or `none` before the first gesture. */
  contextState: string;
}

/** Game sound effects. Every method is a silent no-op when sound is off, locked or unsupported. */
export interface AudioService {
  /** The sound effects switch (the `sfx` setting). */
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  /** The music switch (the `music` setting). */
  readonly musicEnabled: boolean;
  setMusicEnabled(on: boolean): void;
  /** Music player: safe to call before the audio is unlocked (the calls are replayed then). */
  readonly music: MusicControl;
  /** Turns the music down by 40% while any reason holds (a window is open, the record fanfare plays). */
  duckMusic(reason: DuckReason, on: boolean): void;
  /** Plays a registry sound by id (`SOUND_BOOK`); the named methods below are thin wrappers over this. */
  play<K extends SoundId>(id: K, ...args: SoundArgs[K]): void;
  /** The weather bed under the run (`null` for none); remembered until the audio is unlocked. Off in the game unless `WEATHER_BED.enabled`. */
  setBed(kind: BedKind | null): void;
  debugStats(): AudioDebugStats;
  /** Call from a user gesture: creates or resumes the audio context. */
  unlock(): void;
  /** Sound stops for `reason` (the app went to the background, an ad shows). */
  suspend(reason: AudioSuspendReason): void;
  /** `reason` is over; sound returns once no other reason holds. */
  resume(reason: AudioSuspendReason): void;
  /** Regular drop. */
  drop(): void;
  /** Perfect drop; `comboStep` is 1 for the first perfect in a row. */
  perfect(comboStep: number): void;
  bite(): void;
  coin(): void;
  berry(): void;
  ability(rarity: Rarity): void;
  /** The Rainbow layer flies in: a short quiet chime. */
  rainbowChime(): void;
  /** The star of the Rainbow layer pops a small rainbow: a quiet rising ding. */
  rainbowJoke(): void;
  /** The cream cloud of the rainbow deflates: a soft puff. */
  cloudPuff(): void;
  /** The brownie's shield bursts and eats a miss. */
  shieldPop(): void;
  sneeze(): void;
  miss(): void;
  /** One slap of a collapsing tower; `index` is the position in the series (0 = first). */
  collapseThud(index: number): void;
  record(): void;
  /** A short blip: the run crossed the session record (the fanfare is for the results screen). */
  recordBlip(): void;
  click(): void;
  /** A layer licks a drop of glaze off its cheek in one stroke: a short juicy slurp. */
  lickSlurp(): void;
  /** The tongue goes round the whole face: a long "slu-u-urp". */
  lickSlurpLong(): void;
  /** The tongue snaps back into the mouth: a smack. */
  lickSmack(): void;
  /** The licked layer is happy: a short contented "mmm". */
  lickHum(): void;
  /** A layer lands on the guest of the tower (the fly): a low, heavy wet "шмяк". */
  guestSplat(): void;
  /** The flattened guest peels off the layer: a stretchy "чпок". */
  guestPeel(): void;
  /** The guest staggers away, offended: a rattling buzz that falls away. */
  guestBuzz(): void;
  /** A neighbour layer giggles at the splatted guest: a short "хи-хи-хи". */
  guestGiggle(): void;
  /** The topper of a layer hops off when the next layer lands: a springy "boing" and a click. */
  topperHop(): void;
  /** Creature squeak; `pitch` is a multiplier (1 = base pitch). */
  squeak(pitch: number): void;
}

/** What the music was last asked to play, what the player holds and what turns it down (dev checks). */
export interface MusicDebugState extends MusicPlayerState {
  /** What the game asked for last (the playlist or a track), null before the first or after a stop. */
  asked: MusicAsk | null;
  /** Duck reasons that hold now. */
  ducks: string[];
}

/** Dev-only extras of the web audio (the soundboard): live bus levels, not saved. */
export interface AudioDevControl {
  /** Multipliers of the master, sfx and music levels; missing ones stay as they are. */
  setLevels(levels: Partial<{ master: number; sfx: number; music: number }>): void;
  /** The music's asked state and the held ducks. */
  musicState(): MusicDebugState;
  /** Dev-only level correction of one sound in dB, on top of its trim; lives until the page reloads. */
  setSoundTrimDb(id: SoundId, db: number): void;
}
