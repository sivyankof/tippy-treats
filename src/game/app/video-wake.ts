import type { AppShellService } from '../../services/app-shell/types';
/** What waking the ads needs of the ad service. */
interface Wakeable {
  wake(networkBack?: boolean): void;
}

/**
 * Wakes the ad loading (`AdsService.wake`) when the app comes back to the front and when the
 * network comes back, so a load that gave up after its retries starts again without a restart
 * (docs/09-services-analytics.md, section 3).
 */
export function bindVideoWake(
  ads: Wakeable,
  shell: Pick<AppShellService, 'onActiveChange'>,
  win: Pick<Window, 'addEventListener'> = window,
): void {
  shell.onActiveChange((active) => {
    if (active) ads.wake();
  });
  win.addEventListener('online', () => ads.wake(true));
}
