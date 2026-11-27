/** An ad shown from the results screen ("x2 coins"), as the rating request sees it. */
export interface ScreenAd {
  /** The ad is on the screen now. */
  showing(): boolean;
  /**
   * Calls `callback` once, when the ad now showing has closed, whatever it gave. One waiting
   * callback at a time (a later call replaces it); with no ad on, the call does nothing.
   */
  onceClosed(callback: () => void): void;
}

/** Keeps the state of the screen's ad while it shows and tells whoever waits that it closed. */
export class ScreenAdWatch implements ScreenAd {
  private on = false;
  private closed: (() => void) | null = null;

  showing(): boolean {
    return this.on;
  }

  onceClosed(callback: () => void): void {
    if (this.on) this.closed = callback;
  }

  /**
   * Shows the ad with `show`; `apply` takes its result while the screen is `alive`. The waiting
   * callback runs after `apply`, even if `apply` throws; when the screen is gone it is dropped.
   */
  async run<T>(show: () => Promise<T>, alive: () => boolean, apply: (result: T) => void) {
    this.on = true;
    let result: T;
    try {
      result = await show();
    } finally {
      this.on = false;
    }
    const closed = this.closed;
    this.closed = null;
    if (!alive()) return;
    try {
      apply(result);
    } finally {
      closed?.();
    }
  }
}
