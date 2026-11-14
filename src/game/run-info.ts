import type { ActiveEffect } from '../core/abilities/types';
import type { SimPhase, TeamSlot, TowerState } from '../core/sim-types';

/** Read-only snapshot of the run for the HUD and the debug panel. */
export interface RunInfo {
  height: number;
  score: number;
  wobble: number;
  seed: number;
  phase: SimPhase;
  flyingSpeed: number | null;
  paused: boolean;
  /** The team of the run; the same array for the whole run. */
  team: readonly (TeamSlot | null)[];
  /** Live list of the active effects: read it at once, do not keep it. */
  effects: readonly ActiveEffect[];
  /** Layers left on the brownie shield, 0 for none. */
  shield: number;
  /** Index of the zone of the run (the banner announces a change). */
  zoneIndex: number;
  coins: number;
  berries: number;
}

export function emptyRunInfo(): RunInfo {
  return {
    height: 0,
    score: 0,
    wobble: 0,
    seed: 0,
    phase: 'flying',
    flyingSpeed: null,
    paused: false,
    team: [],
    effects: [],
    shield: 0,
    zoneIndex: 0,
    coins: 0,
    berries: 0,
  };
}

/** Refills `info` from the run state and returns it. */
export function fillRunInfo(
  info: RunInfo,
  s: Readonly<TowerState>,
  seed: number,
  team: readonly (TeamSlot | null)[],
  paused: boolean,
): RunInfo {
  info.height = s.height;
  info.score = s.score;
  info.wobble = s.wobble;
  info.seed = seed;
  info.phase = s.phase;
  info.flyingSpeed = s.flying?.speed ?? null;
  info.paused = paused;
  info.team = team;
  info.effects = s.effects;
  info.shield = s.shield;
  info.zoneIndex = s.zoneIndex;
  info.coins = s.coins;
  info.berries = s.berries;
  return info;
}
