/** Timings of the native app around the game (src/game/app/native-shell.ts). */
export const APP_SHELL = {
  /** The launch splash goes away by then even if no screen of the game has drawn (so an error box shows). */
  splashMaxMs: 8000,
  /** After the app comes back, the audio is asked to run again this much later: a call or an alarm may still hold it. */
  audioRetryMs: 600,
} as const;
