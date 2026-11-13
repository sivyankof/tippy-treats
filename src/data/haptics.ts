const MEDIUM_MS = 20;
const TRIPLE_GAP_MS = 70;

/**
 * Haptics tuning from docs/06-art-animation-audio.md section 8.
 * Patterns are `navigator.vibrate` values (milliseconds, odd entries are pauses)
 * used by the browser stub; native haptics map kinds to system impact styles.
 */
export const HAPTICS = {
  /** Vibrate patterns of the browser stub, per kind. */
  patterns: {
    light: [10],
    medium: [MEDIUM_MS],
    heavy: [40],
    selection: [6],
    success: [15, 40, 25],
    error: [40, 50, 40],
    /** Three medium hits with a gap between them. */
    triple: [MEDIUM_MS, TRIPLE_GAP_MS, MEDIUM_MS, TRIPLE_GAP_MS, MEDIUM_MS],
  },
  /** Pause between the three medium hits of the record series (ms). */
  tripleGap: TRIPLE_GAP_MS,
  /** Cut wider than this share of the layer width counts as a big bite (heavy impact). */
  bigBiteShare: 0.3,
} as const;
