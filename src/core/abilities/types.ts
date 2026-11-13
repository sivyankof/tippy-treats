import { BALANCE } from '../../data/balance';

/** Narrowed to the list of creature ids once data/creatures.ts exists. */
export type CreatureId = string;

export interface ActiveEffect {
  id: string;
  /** Layers left until the effect ends. */
  layersLeft: number;
}

/** Everything abilities and zone rules can change about a drop. */
export interface Modifiers {
  speedMult: number;
  scoreMult: number;
  coinMultAdd: number;
  perfectTolerance: number;
  autoPerfect: boolean;
  guides: boolean;
  crumbToCoinsPx: number | null;
}

export const BASE_MODIFIERS: Readonly<Modifiers> = {
  speedMult: 1,
  scoreMult: 1,
  coinMultAdd: 0,
  perfectTolerance: BALANCE.drop.perfectTolerance,
  autoPerfect: false,
  guides: false,
  crumbToCoinsPx: null,
};
