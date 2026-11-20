/** What counting the days of play needs of the state. */
interface PlayDayCounter {
  notePlayDay(): void;
}

/** What it needs of the shell: the app coming back to the front. */
interface ActiveSource {
  onActiveChange(callback: (active: boolean) => void): () => void;
}

/**
 * Counts a day of play (`review.playDays`, docs/04-meta-retention.md, section 10) when the game is
 * launched and when it comes back to the front: in the app through the shell, in a browser through
 * the page becoming visible. A day is counted once however many times this fires.
 */
export function bindPlayDays(
  state: PlayDayCounter,
  shell: ActiveSource,
  doc: Pick<Document, 'addEventListener' | 'visibilityState'> = document,
): void {
  state.notePlayDay();
  shell.onActiveChange((active) => {
    if (active) state.notePlayDay();
  });
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') state.notePlayDay();
  });
}
