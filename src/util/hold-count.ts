/**
 * Counts holders of one on/off state: `apply(true)` when the first holder comes, `apply(false)`
 * when the last one lets go. Each `hold()` gives its own release, safe to call twice, so nested
 * holders (a window over a window) never end the state early.
 */
export class HoldCount {
  private holders = 0;

  constructor(private readonly apply: (on: boolean) => void) {}

  get held(): boolean {
    return this.holders > 0;
  }

  /** Takes a hold; returns the function that lets it go. */
  hold(): () => void {
    this.holders += 1;
    if (this.holders === 1) this.apply(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders -= 1;
      if (this.holders === 0) this.apply(false);
    };
  }
}
