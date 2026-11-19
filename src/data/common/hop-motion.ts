/** The idle and invitation motion of a closed box or chest: a sway, and now and then a hop with squash. */
export interface HopMotion {
  sway: { idleDeg: number; readyDeg: number; ms: number };
  hop: {
    /** A ready object hops this often. */
    everyMs: number;
    /** Pixels in the parent's space. */
    rise: number;
    riseMs: number;
    fallMs: number;
    /** Scale factors for the crouch before the jump and the landing, and for the stretch in the air. */
    squash: { x: number; y: number; ms: number };
    stretch: { x: number; y: number };
  };
}
