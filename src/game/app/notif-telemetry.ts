import { services } from '../../services';

/** The answer to the system's request for notifications (`notif_permission`); call it once per answer. */
export function logNotifPermission(granted: boolean): void {
  services.telemetry.logEvent('notif_permission', { granted });
}
