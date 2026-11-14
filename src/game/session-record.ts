/**
 * Best height of this browser session, kept in memory (saving arrives with the save system).
 * The first run of a session is never a record.
 */
export class SessionRecord {
  private bestHeight: number | null = null;

  /** Best height so far, `null` before the first run ends. */
  get best(): number | null {
    return this.bestHeight;
  }

  /** Registers a finished run; true when an earlier run exists and `height` beats the best. */
  noteRun(height: number): boolean {
    const previous = this.bestHeight;
    if (previous === null || height > previous) this.bestHeight = height;
    return previous !== null && height > previous;
  }
}

/** The record of the running session. */
export const sessionRecord = new SessionRecord();
