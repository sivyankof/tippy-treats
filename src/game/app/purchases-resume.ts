/** What it needs of the shell: the app coming back to the front. */
interface ActiveSource {
  onActiveChange(callback: (active: boolean) => void): () => void;
}

/**
 * Reconciles the purchases with the store each time the app comes back to the front, so an
 * "Ask to Buy" approved while the game was in the background is paid without a restart. The
 * browser has no store to ask, so nothing is repeated there.
 */
export function bindPurchasesResume(shell: ActiveSource, reconcile: () => Promise<void>): void {
  shell.onActiveChange((active) => {
    if (active) void reconcile().catch(() => undefined);
  });
}
