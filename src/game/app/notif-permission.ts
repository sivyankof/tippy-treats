import type { NotificationsService } from '../../services/notifications/types';
import type { AnalyticsService } from '../../services/telemetry/types';

/** What asking for the permission touches: the service, the answer's event and the "asked" mark. */
export interface NotifPermissionDeps {
  notifications: NotificationsService;
  telemetry: AnalyticsService;
  markAsked(): void;
}

/**
 * Makes sure the system lets the game show notifications: true at once when it already does,
 * otherwise asks (the system dialog; nothing shows when it no longer asks) and tells the answer to
 * the analytics (`notif_permission`, docs/09-services-analytics.md, section 6). Asking counts as
 * the question being asked, so the game's own question does not come after it.
 */
export async function ensureNotifPermission(deps: NotifPermissionDeps): Promise<boolean> {
  if (await deps.notifications.hasPermission()) return true;
  const granted = await deps.notifications.requestPermission();
  deps.markAsked();
  deps.telemetry.logEvent('notif_permission', { granted });
  return granted;
}
