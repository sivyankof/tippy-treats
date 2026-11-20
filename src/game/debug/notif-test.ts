import type { PlannedNotif } from '../../core/progression/notif-plan';
import { NOTIF } from '../../data/progression/notif';
import { realNow } from '../../util/clock';

/**
 * A test notification for the phone (debug menu): once armed, the next time the app goes to the
 * background a notification is added to the plan, due `NOTIF.testDelayMs` later.
 */
export function createNotifTest(nowMs: () => number): {
  arm(): void;
  armed(): boolean;
  /** The test notification when armed (disarms it), nothing otherwise. */
  take(): PlannedNotif[];
} {
  let on = false;
  return {
    arm: () => {
      on = true;
    },
    armed: () => on,
    take: () => {
      if (!on) return [];
      on = false;
      return [
        {
          id: NOTIF.ids.test,
          at: new Date(nowMs() + NOTIF.testDelayMs),
          titleKey: 'notif.gift.title',
          bodyKey: 'notif.gift.body',
        },
      ];
    },
  };
}

/** The one test notification of the debug menu, on the real clock. */
export const notifTest = createNotifTest(realNow);
