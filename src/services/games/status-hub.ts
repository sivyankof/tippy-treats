import type { GamesStatus } from './types';

/** The status of the game services and its listeners; a listener that throws hurts no other. */
export class StatusHub {
  private listeners = new Set<(status: GamesStatus) => void>();

  constructor(private current: GamesStatus) {}

  get status(): GamesStatus {
    return this.current;
  }

  set(next: GamesStatus): void {
    if (next === this.current) return;
    this.current = next;
    for (const listener of [...this.listeners]) {
      try {
        listener(next);
      } catch {
        // A screen's listener is not the service's problem.
      }
    }
  }

  on(listener: (status: GamesStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
