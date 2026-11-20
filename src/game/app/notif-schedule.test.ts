import { describe, expect, it } from 'vitest';
import type { PlannedNotif } from '../../core/progression/notif-plan';
import { createDefaultSave } from '../../core/save/defaults';
import type { Save } from '../../core/save/schema';
import type { AppShellService } from '../../services/app-shell/types';
import type { NotificationsService } from '../../services/notifications/types';
import { ensureNotifPermission } from './notif-permission';
import { bindNotifSchedule, type NotifScheduleState } from './notif-schedule';

const local = (month: number, day: number, hour: number): number =>
  new Date(2026, month - 1, day, hour).getTime();

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function fakeShell(): AppShellService & { emit(active: boolean): void } {
  let callback: (active: boolean) => void = () => undefined;
  return {
    native: true,
    onActiveChange: (cb) => {
      callback = cb;
      return () => undefined;
    },
    onBack: () => () => undefined,
    minimize: () => undefined,
    hideSplash: () => undefined,
    setBarIcons: () => undefined,
    openExternal: () => undefined,
    deviceInfo: () => Promise.resolve({ model: 'test', os: 'test' }),
    appBuild: () => Promise.resolve(null),
    emit: (active) => callback(active),
  };
}

function fakeService(
  granted: boolean,
): NotificationsService & { log: string[]; plans: PlannedNotif[][] } {
  const log: string[] = [];
  const plans: PlannedNotif[][] = [];
  return {
    log,
    plans,
    hasPermission: () => Promise.resolve(granted),
    requestPermission: () => Promise.resolve(granted),
    rescheduleAll: (plan) => {
      log.push('reschedule');
      plans.push([...plan]);
      return Promise.resolve();
    },
    cancelAll: () => {
      log.push('cancel');
      return Promise.resolve();
    },
  };
}

function fakeState(save: Save): NotifScheduleState & { giftDays: string[] } {
  const giftDays: string[] = [];
  return {
    giftDays,
    data: save,
    setGiftNotifDay: (day) => giftDays.push(day),
  };
}

const NOW = local(11, 20, 12);

function boundSave(): Save {
  const save = createDefaultSave(NOW, 'test');
  return { ...save, gift: { nextAt: NOW + 2 * 3_600_000 } };
}

describe('bindNotifSchedule', () => {
  it('cancels everything at the launch', async () => {
    const service = fakeService(true);
    bindNotifSchedule(fakeShell(), service, fakeState(boundSave()), () => NOW);
    await flush();
    expect(service.log).toEqual(['cancel']);
  });

  it('builds and schedules the plan when the app goes to the background', async () => {
    const shell = fakeShell();
    const service = fakeService(true);
    bindNotifSchedule(shell, service, fakeState(boundSave()), () => NOW);
    shell.emit(false);
    await flush();
    expect(service.log).toEqual(['cancel', 'reschedule']);
    const ids = service.plans[0]?.map((item) => item.titleKey);
    expect(ids).toContain('notif.gift.title');
  });

  it('cancels again when the app comes back', async () => {
    const shell = fakeShell();
    const service = fakeService(true);
    bindNotifSchedule(shell, service, fakeState(boundSave()), () => NOW);
    shell.emit(false);
    shell.emit(true);
    await flush();
    expect(service.log).toEqual(['cancel', 'cancel']);
  });

  it('schedules nothing without the permission', async () => {
    const shell = fakeShell();
    const service = fakeService(false);
    bindNotifSchedule(shell, service, fakeState(boundSave()), () => NOW);
    shell.emit(false);
    await flush();
    expect(service.log).toEqual(['cancel']);
  });

  it('adds the extra notifications to the plan', async () => {
    const shell = fakeShell();
    const service = fakeService(true);
    const extra: PlannedNotif = { id: 99, at: new Date(NOW + 60_000), titleKey: 'a', bodyKey: 'b' };
    bindNotifSchedule(
      shell,
      service,
      fakeState(boundSave()),
      () => NOW,
      () => [extra],
    );
    shell.emit(false);
    await flush();
    expect(service.plans[0]).toContainEqual(extra);
  });

  it('stores the day of a gift notification that has gone out when the app opens', async () => {
    const shell = fakeShell();
    const service = fakeService(true);
    const save = { ...boundSave(), gift: { nextAt: NOW - 3_600_000 } };
    const state = fakeState(save);
    bindNotifSchedule(shell, service, state, () => NOW);
    expect(state.giftDays).toEqual(['2026-11-20']);
  });
});

describe('ensureNotifPermission', () => {
  function deps(granted: boolean, has: boolean) {
    const events: Array<[string, unknown]> = [];
    let asked = 0;
    const service = fakeService(granted);
    return {
      events,
      asked: () => asked,
      deps: {
        notifications: { ...service, hasPermission: () => Promise.resolve(has) },
        telemetry: {
          logEvent: (name: string, params?: unknown) => events.push([name, params]),
          setUserProperty: () => undefined,
        },
        markAsked: () => {
          asked++;
        },
      },
    };
  }

  it('does nothing when the permission is there', async () => {
    const d = deps(true, true);
    expect(await ensureNotifPermission(d.deps)).toBe(true);
    expect(d.events).toEqual([]);
    expect(d.asked()).toBe(0);
  });

  it('asks, marks the question and reports the answer', async () => {
    const yes = deps(true, false);
    expect(await ensureNotifPermission(yes.deps)).toBe(true);
    expect(yes.events).toEqual([['notif_permission', { granted: true }]]);
    expect(yes.asked()).toBe(1);
    const no = deps(false, false);
    expect(await ensureNotifPermission(no.deps)).toBe(false);
    expect(no.events).toEqual([['notif_permission', { granted: false }]]);
  });
});
