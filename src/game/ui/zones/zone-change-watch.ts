/**
 * Notices when a run moves into a higher zone. The first zone it sees is only a baseline,
 * so nothing is announced at the start of a run (or of a debug run that starts deep in the
 * tower). A lower zone, which means the run was restarted, resets the baseline silently.
 */
export class ZoneChangeWatch {
  private last: number | null = null;

  /** Feed the current zone every frame (`null` when no run is there yet); returns the zone to announce, if any. */
  observe(zoneIndex: number | null): number | null {
    if (zoneIndex === null) return null;
    const previous = this.last;
    this.last = zoneIndex;
    return previous !== null && zoneIndex > previous ? zoneIndex : null;
  }
}
