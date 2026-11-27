/** How the veil of a `PopupWindow` comes and goes; see `PopupOptions.veil`. */
export interface VeilHandover {
  in?: 'fade' | 'shown';
  out?: 'fade' | 'keep';
}

/**
 * What a closing window does once its frame has shrunk away. A window that keeps its veil opens
 * the next one first, so the next veil is already standing when this one goes: there is never a
 * frame without a veil, never two veils, and the music duck is held throughout.
 */
export function closeSteps(keepVeil: boolean): ReadonlyArray<'destroy' | 'onClosed'> {
  return keepVeil ? ['onClosed', 'destroy'] : ['destroy', 'onClosed'];
}

/** A release counts as a tap on the veil only when the same press went down on it (`downTime` of the pointer). */
export function pressBeganHere(downAtHere: number, pressDownTime: number): boolean {
  return downAtHere >= 0 && downAtHere === pressDownTime;
}
