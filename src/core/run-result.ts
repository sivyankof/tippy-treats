export type RunMode = 'classic' | 'daily';

/** `quit` is reported by the scene when the player leaves a run; the simulation never produces it. */
export type RunEndReason = 'miss' | 'sneeze' | 'quit';

export interface RunResult {
  seed: number;
  mode: RunMode;
  height: number;
  score: number;
  coins: number;
  berries: number;
  perfects: number;
  bestCombo: number;
  continuesUsed: number;
  zoneIndex: number;
  /** Simulated time, pauses for the continue offer excluded. */
  durationMs: number;
  endReason: RunEndReason;
}
