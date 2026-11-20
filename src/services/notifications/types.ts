import type { PlannedNotif } from '../../core/progression/notif-plan';

/**
 * Local notifications (docs/09-services-analytics.md, section 8). The game builds the plan, the
 * service only delivers it; every call resolves, a failing plugin never throws into the game.
 */
export interface NotificationsService {
  /** Asks the system for the permission; false on a refusal, or when the system no longer asks. */
  requestPermission(): Promise<boolean>;
  /** True when notifications may be shown. */
  hasPermission(): Promise<boolean>;
  /** Replaces everything scheduled with `plan`; texts are taken by key in the current language. */
  rescheduleAll(plan: readonly PlannedNotif[]): Promise<void>;
  /** Removes everything scheduled and clears the ones already shown. */
  cancelAll(): Promise<void>;
}

/** Texts of a notification by key, in the language of the game. */
export type NotifText = (key: string) => string;
