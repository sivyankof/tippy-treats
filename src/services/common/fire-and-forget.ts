/** A rejection handler that drops the error (a blocked domain or a missing plugin is not the game's problem). */
export const ignore = (): undefined => undefined;

/**
 * Runs a plugin call without waiting for it: a rejected promise and a throw at once are both
 * dropped, so a failing plugin can never cause a failure in the game.
 */
export function fireAndForget(call: () => Promise<unknown>): void {
  try {
    call().catch(ignore);
  } catch {
    // A plugin that throws at once is as harmless as one that rejects.
  }
}
