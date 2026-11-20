import {
  buildNotifPlan,
  giftDayToStore,
  type PlannedNotif,
} from '../../core/progression/notif-plan';
import type { Save } from '../../core/save/schema';
import type { AppShellService } from '../../services/app-shell/types';
import type { NotificationsService } from '../../services/notifications/types';

/** What the schedule reads and writes of the game state. */
export interface NotifScheduleState {
  readonly data: Readonly<Save>;
  setGiftNotifDay(day: string): void;
}

/**
 * Local notifications follow the app's lifecycle (docs/09-services-analytics.md, section 8): when
 * the app stops being active the plan is built from the save and scheduled (with the permission);
 * when it is active again (and at the launch) everything scheduled is cancelled. The calls go one
 * after another, so a quick return never meets a schedule that lands late. `extra` adds
 * notifications to the plan (the debug test). Returns the function that stops it.
 */
export function bindNotifSchedule(
  shell: AppShellService,
  notifications: NotificationsService,
  state: NotifScheduleState,
  nowMs: () => number,
  extra: () => PlannedNotif[] = () => [],
): () => void {
  let active = true;
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (job: () => Promise<void>): void => {
    queue = queue.then(job).catch(() => undefined);
  };

  const opened = (): void => {
    active = true;
    const day = giftDayToStore(state.data, nowMs());
    if (day !== null) state.setGiftNotifDay(day);
    enqueue(() => notifications.cancelAll());
  };

  const closed = (): void => {
    active = false;
    const plan = [...buildNotifPlan(state.data, nowMs()), ...extra()];
    enqueue(async () => {
      // Back in the app before this job's turn: nothing to schedule.
      if (active || !(await notifications.hasPermission()) || active) return;
      await notifications.rescheduleAll(plan);
    });
  };

  opened();
  return shell.onActiveChange((isActive) => (isActive ? opened() : closed()));
}
