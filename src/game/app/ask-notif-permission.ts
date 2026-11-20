import { services } from '../../services';
import { gameState } from '../../state';
import { ensureNotifPermission } from './notif-permission';

/** `ensureNotifPermission` wired to the game's services and state: the one way the game asks. */
export function askNotifPermission(): Promise<boolean> {
  return ensureNotifPermission({
    notifications: services.notifications,
    telemetry: services.telemetry,
    markAsked: () => gameState.markNotifAsked(),
  });
}
