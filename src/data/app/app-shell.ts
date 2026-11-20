/** Timings of the native app around the game (src/game/app/native-shell.ts). */
export const APP_SHELL = {
  /** The launch splash goes away by then even if no screen of the game has drawn (so an error box shows). */
  splashMaxMs: 8000,
  /** Colour of the status bar icons (src/game/app/status-bar.ts). */
  statusBar: {
    /** The screen is looked at this often. */
    checkMs: 150,
    /** A new colour is set only after this many checks in a row agree, so a window that flicks by does not blink the bar. */
    holdChecks: 2,
    /** A dark veil counts once this much of it covers the screen (its alpha times its fill alpha). */
    veilDarkness: 0.3,
  },
} as const;
