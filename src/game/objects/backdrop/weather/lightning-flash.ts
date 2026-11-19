/**
 * Where a flash of lightning is told to those who react to it (the layers of the tower startle). The cloud banks
 * of a storm call `announceFlash` when a flash begins; the run listens with `onLightningFlash`. `sky` is a flash in
 * the Roof or the Clouds, `street` one behind the glass of the Showcase (a weaker scare).
 */
export type FlashKind = 'sky' | 'street';

type Listener = (kind: FlashKind) => void;

const listeners = new Set<Listener>();

/** Calls `listener` at every flash until the returned function is called. */
export function onLightningFlash(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceFlash(kind: FlashKind): void {
  for (const listener of listeners) listener(kind);
}
