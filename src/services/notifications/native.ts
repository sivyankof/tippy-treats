import { ignore } from '../common/fire-and-forget';
import type { PlannedNotif } from '../../core/progression/notif-plan';
import type { NotificationsService, NotifText } from './types';

type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

/** What the game needs of `@capacitor/local-notifications` (injected, so tests run without the app). */
export interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: PermissionState }>;
  requestPermissions(): Promise<{ display: PermissionState }>;
  getPending(): Promise<{ notifications: Array<{ id: number }> }>;
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>;
  removeAllDeliveredNotifications(): Promise<void>;
  schedule(options: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date };
      /** Android: schedule inexactly, never open the "Alarms & reminders" settings screen. */
      isExactNotification: boolean;
    }>;
  }): Promise<unknown>;
}

/**
 * The system's local notifications. Inexact on Android (the exact-alarm permission is removed
 * from the manifest on purpose, and `allowWhileIdle` is not used), texts localized when scheduled.
 * A permission the system no longer asks about (denied) is not asked again. A failing call is
 * dropped: the game goes on without notifications.
 */
export class NativeNotifications implements NotificationsService {
  constructor(
    private readonly plugin: LocalNotificationsPlugin,
    private readonly text: NotifText,
  ) {}

  async hasPermission(): Promise<boolean> {
    try {
      return (await this.plugin.checkPermissions()).display === 'granted';
    } catch {
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      const { display } = await this.plugin.checkPermissions();
      if (display === 'granted') return true;
      if (display === 'denied') return false;
      return (await this.plugin.requestPermissions()).display === 'granted';
    } catch {
      return false;
    }
  }

  async rescheduleAll(plan: readonly PlannedNotif[]): Promise<void> {
    try {
      await this.cancelPending();
      if (plan.length === 0) return;
      await this.plugin.schedule({
        notifications: plan.map((item) => ({
          id: item.id,
          title: this.text(item.titleKey),
          body: this.text(item.bodyKey),
          schedule: { at: item.at },
          isExactNotification: false,
        })),
      });
    } catch {
      // No notifications this time; the next background tries again.
    }
  }

  async cancelAll(): Promise<void> {
    await this.cancelPending().catch(ignore);
    await this.plugin.removeAllDeliveredNotifications().catch(ignore);
  }

  private async cancelPending(): Promise<void> {
    const { notifications } = await this.plugin.getPending();
    if (notifications.length > 0) {
      await this.plugin.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
    }
  }
}
