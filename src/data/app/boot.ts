/** Start-up of the page, before the game exists. */
export const BOOT = {
  /**
   * The game waits this long for the Nunito files and then starts anyway with the fallback
   * font: a browser whose font loading never settles must not leave a blank page.
   */
  fontWaitMs: 3000,
  /** Longest wait for the save to be read; the storage of a phone answers in milliseconds. */
  saveWaitMs: 2000,
} as const;
