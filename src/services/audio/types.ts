import type { Rarity } from '../../data/rarity';

/** Why sound is held back; the audio runs again only when none is left. */
export type AudioSuspendReason = 'app' | 'ad';

/** Game sound effects. Every method is a silent no-op when sound is off, locked or unsupported. */
export interface AudioService {
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
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
  /** Creature squeak; `pitch` is a multiplier (1 = base pitch). */
  squeak(pitch: number): void;
}
