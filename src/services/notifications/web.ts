import type { PlannedNotif } from '../../core/progression/notif-plan';
import type { NotificationsService } from './types';

/**
 * Browser stub: nothing is ever scheduled. In development it pretends to have the permission once
 * asked and writes the plan to the console, so the plan can be read there.
 */
export class WebNotifications implements NotificationsService {
  private granted = false;

  constructor(
    private readonly dev: boolean,
    private readonly log: (message: string) => void = (message) => console.info(message),
  ) {}

  requestPermission(): Promise<boolean> {
    this.granted = this.dev;
    return Promise.resolve(this.granted);
  }

  hasPermission(): Promise<boolean> {
    return Promise.resolve(this.granted);
  }

  rescheduleAll(plan: readonly PlannedNotif[]): Promise<void> {
    if (this.dev) {
      const lines = plan.map((item) => `${item.at.toString()} ${item.titleKey}`);
      this.log(`[notifications] plan (${plan.length}): ${lines.join('; ') || 'empty'}`);
    }
    return Promise.resolve();
  }

  cancelAll(): Promise<void> {
    return Promise.resolve();
  }
}
