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

/** A run left before anything was earned: nothing to keep, so it is not counted as a run. */
export function isEmptyRun(result: RunResult, startHeight = 0): boolean {
  return (
    result.height <= startHeight && result.score <= 0 && result.coins <= 0 && result.berries <= 0
  );
}
