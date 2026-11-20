import {
  buildNotifPlan,
  giftDayToStore,
  type PlannedNotif,
} from '../../core/progression/notif-plan';
import { NOTIF } from '../../data/progression/notif';
import type { Save } from '../../core/save/schema';
import type { AppShellService } from '../../services/app-shell/types';
import type { NotificationsService } from '../../services/notifications/types';
import { localDay } from '../../util/calendar';

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
  // The gift moment the last background really scheduled (null: none); undefined until the first
  // open of this launch (the launch itself), when the memory of an earlier launch is gone.
  let scheduledGiftAt: number | null | undefined;
  const enqueue = (job: () => Promise<void>): void => {
    queue = queue.then(job).catch(() => undefined);
  };

  /** The day of the scheduled gift notification when its moment has passed (it went out while away). */
  const sentDay = (): string | null =>
    scheduledGiftAt !== null && scheduledGiftAt !== undefined && scheduledGiftAt <= nowMs()
      ? localDay(scheduledGiftAt)
      : null;

  const opened = (): void => {
    active = true;
    const day = scheduledGiftAt === undefined ? giftDayToStore(state.data, nowMs()) : sentDay();
    scheduledGiftAt = null;
    if (day !== null && day !== state.data.notif.giftDay) state.setGiftNotifDay(day);
    enqueue(() => notifications.cancelAll());
  };

  const closed = (): void => {
    active = false;
    const plan = buildNotifPlan(state.data, nowMs());
    enqueue(async () => {
      // Back in the app before this job's turn: nothing to schedule.
      if (active || !(await notifications.hasPermission()) || active) return;
      // Taken only now, so a debug test is not used up by a job that schedules nothing.
      const all = [...plan, ...extra()];
      await notifications.rescheduleAll(all);
      const gift = plan.find((item) => item.id === NOTIF.ids.gift);
      scheduledGiftAt = gift ? gift.at.getTime() : null;
    });
  };

  opened();
  return shell.onActiveChange((isActive) => (isActive ? opened() : closed()));
}
