import type { Rarity } from '../../data/rarity';

/** Game sound effects. Every method is a silent no-op when sound is off, locked or unsupported. */
export interface AudioService {
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  /** Call from a user gesture: creates or resumes the audio context. */
  unlock(): void;
  /** The app went to the background. */
  suspend(): void;
  /** The app is visible again. */
  resume(): void;
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
  click(): void;
  /** Creature squeak; `pitch` is a multiplier (1 = base pitch). */
  squeak(pitch: number): void;
}
