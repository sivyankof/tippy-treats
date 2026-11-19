/** Where a creature of the backdrop is on the screen now, and how large it is drawn. */
export interface SourcePoint {
  x: number;
  y: number;
  scale: number;
}

/**
 * A creature of the zone backdrop that may leave it for the tower (the kitchen fly lands on the
 * top layer). While it is away the backdrop copy is hidden and starts no new pass.
 */
export interface GuestSource {
  /** Fills `out` with the creature's place when it is in view right now; false when it is not. */
  peek(out: SourcePoint): boolean;
  /** Holds the backdrop copy (hidden, no new passes) while the tower's guest is out. */
  suspend(on: boolean): void;
}
