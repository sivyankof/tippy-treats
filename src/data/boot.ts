/** Start-up of the page, before the game exists. */
export const BOOT = {
  /**
   * The game waits this long for the Nunito files and then starts anyway with the fallback
   * font: a browser whose font loading never settles must not leave a blank page.
   */
  fontWaitMs: 3000,
} as const;
