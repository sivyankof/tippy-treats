/** What waking the ads needs of the ad service. */
interface Wakeable {
  wake(): void;
}

/** What it needs of the shell: the app coming back to the front. */
interface ActiveSource {
  onActiveChange(callback: (active: boolean) => void): () => void;
}

/**
 * Wakes the ad loading (`AdsService.wake`) when the app comes back to the front and when the
 * network comes back, so a load that gave up after its retries starts again without a restart
 * (docs/09-services-analytics.md, section 3).
 */
export function bindVideoWake(
  ads: Wakeable,
  shell: ActiveSource,
  win: Pick<Window, 'addEventListener'> = window,
): void {
  shell.onActiveChange((active) => {
    if (active) ads.wake();
  });
  win.addEventListener('online', () => ads.wake());
}
