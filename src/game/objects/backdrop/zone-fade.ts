/** Smooth start and end of the cross-fade. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * The timeline of the backdrop: which zone is current, which one it is flowing in from
 * and how visible each is. The new zone fades in over the old one, which stays fully
 * visible underneath until the fade ends.
 */
export class ZoneFade {
  private from: number | null = null;
  private to: number;
  private elapsedMs = 0;

  constructor(
    initialZone: number,
    private readonly durationMs: number,
  ) {
    this.to = initialZone;
  }

  /** The zone the backdrop is showing, or flowing into. */
  get current(): number {
    return this.to;
  }

  /** The zone being replaced, while the fade runs; `null` otherwise. */
  get previous(): number | null {
    return this.from;
  }

  /** 0..1 progress of the running fade, 1 when none runs. */
  get progress(): number {
    return this.from === null ? 1 : Math.min(1, this.elapsedMs / this.durationMs);
  }

  /** Starts flowing into `zone`. A fade in progress is cut: the zone it was heading for becomes the old one. */
  goTo(zone: number): void {
    if (zone === this.to) return;
    this.from = this.to;
    this.to = zone;
    this.elapsedMs = 0;
  }

  update(deltaMs: number): void {
    if (this.from === null) return;
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.durationMs) this.from = null;
  }

  /** Alpha of a zone: 0 for one that is not shown. */
  alphaOf(zone: number): number {
    if (zone === this.to) return this.from === null ? 1 : smoothstep(this.progress);
    return zone === this.from ? 1 : 0;
  }
}
