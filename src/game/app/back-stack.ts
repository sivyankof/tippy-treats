/** What the back of Android does on the screen or window that registered it; true when it acted. */
export type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

/**
 * Registers what the Android back does while a screen or a window is on show; the latest one that
 * acts wins (a window over its screen). Returns the function that removes it; call it when the
 * screen or the window goes away.
 */
export function pushBack(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** Runs the back of the topmost handler that acts; false when none did (the app then goes to the background). */
export function handleBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]?.()) return true;
  }
  return false;
}

/** How many handlers are registered (the dev leak check watches it). */
export function backHandlerCount(): number {
  return handlers.length;
}
