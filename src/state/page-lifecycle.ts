import type { GameState } from './game-state';

/** Writes the save at once when the page goes to the background or closes. */
export function bindSaveFlush(
  state: GameState,
  doc: Document = document,
  win: Window = window,
): void {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') state.flush();
  });
  win.addEventListener('pagehide', () => state.flush());
}

/**
 * Page unload during a run (`pagehide`: a tab closed, a reload, the page frozen into the
 * back/forward cache) counts as quitting it: `onLeave` records the run. Going to the
 * background (`visibilitychange`) is not a leave. If the page comes back from the cache after a
 * leave (`pageshow` with `persisted`), `onRestore` starts a fresh run, because the old one is
 * already recorded. Returns the unsubscribe function.
 */
export function bindPageLeave(
  onLeave: () => void,
  onRestore: () => void,
  win: Window = window,
): () => void {
  let left = false;
  const hide = (): void => {
    left = true;
    onLeave();
  };
  const show = (event: Event): void => {
    if (!left || !(event as PageTransitionEvent).persisted) return;
    left = false;
    onRestore();
  };
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  return () => {
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', show);
  };
}
