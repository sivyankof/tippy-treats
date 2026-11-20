import { describe, expect, it } from 'vitest';
import type { PlannedNotif } from '../../core/progression/notif-plan';
import { type LocalNotificationsPlugin, NativeNotifications } from './native';
import { WebNotifications } from './web';

type Permission = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

interface Fake extends LocalNotificationsPlugin {
  calls: string[];
  scheduled: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    isExactNotification: boolean;
  }>;
}

function fakePlugin(
  state: { permission: Permission; answer: Permission; pending: number[]; fail?: boolean } = {
    permission: 'prompt',
    answer: 'granted',
    pending: [],
  },
): Fake {
  const calls: string[] = [];
  const scheduled: Fake['scheduled'] = [];
  const guard = (): void => {
    if (state.fail) throw new Error('plugin failed');
  };
  return {
    calls,
    scheduled,
    checkPermissions: () => {
      calls.push('check');
      guard();
      return Promise.resolve({ display: state.permission });
    },
    requestPermissions: () => {
      calls.push('request');
      guard();
      state.permission = state.answer;
      return Promise.resolve({ display: state.answer });
    },
    getPending: () => {
      calls.push('pending');
      guard();
      return Promise.resolve({ notifications: state.pending.map((id) => ({ id })) });
    },
    cancel: ({ notifications }) => {
      calls.push(`cancel:${notifications.map(({ id }) => id).join(',')}`);
      return Promise.resolve();
    },
    removeAllDeliveredNotifications: () => {
      calls.push('removeDelivered');
      return Promise.resolve();
    },
    schedule: ({ notifications }) => {
      calls.push('schedule');
      scheduled.push(...notifications);
      return Promise.resolve({});
    },
  };
}

const text = (key: string): string => `<${key}>`;

const item = (id: number, at: number): PlannedNotif => ({
  id,
  at: new Date(at),
  titleKey: `k${id}.title`,
  bodyKey: `k${id}.body`,
});

describe('NativeNotifications permission', () => {
  it('reports the state without asking', async () => {
    const plugin = fakePlugin({ permission: 'granted', answer: 'granted', pending: [] });
    const service = new NativeNotifications(plugin, text);
    expect(await service.hasPermission()).toBe(true);
    expect(plugin.calls).toEqual(['check']);
  });

  it('asks the system when it has not been asked', async () => {
    const plugin = fakePlugin();
    expect(await new NativeNotifications(plugin, text).requestPermission()).toBe(true);
    expect(plugin.calls).toEqual(['check', 'request']);
  });

  it('asks again on the rationale state of Android', async () => {
    const plugin = fakePlugin({
      permission: 'prompt-with-rationale',
      answer: 'denied',
      pending: [],
    });
    expect(await new NativeNotifications(plugin, text).requestPermission()).toBe(false);
    expect(plugin.calls).toContain('request');
  });

  it('does not ask when the system no longer asks (denied) or when it is granted', async () => {
    const denied = fakePlugin({ permission: 'denied', answer: 'granted', pending: [] });
    expect(await new NativeNotifications(denied, text).requestPermission()).toBe(false);
    expect(denied.calls).toEqual(['check']);
    const granted = fakePlugin({ permission: 'granted', answer: 'denied', pending: [] });
    expect(await new NativeNotifications(granted, text).requestPermission()).toBe(true);
    expect(granted.calls).toEqual(['check']);
  });

  it('answers false when the plugin fails', async () => {
    const plugin = fakePlugin({ permission: 'prompt', answer: 'granted', pending: [], fail: true });
    const service = new NativeNotifications(plugin, text);
    expect(await service.hasPermission()).toBe(false);
    expect(await service.requestPermission()).toBe(false);
  });
});

describe('NativeNotifications schedule', () => {
  it('replaces the pending ones and localizes by key, inexact and without idle wake-up', async () => {
    const plugin = fakePlugin({ permission: 'granted', answer: 'granted', pending: [7, 8] });
    await new NativeNotifications(plugin, text).rescheduleAll([item(1, 1000), item(2, 2000)]);
    expect(plugin.calls).toEqual(['pending', 'cancel:7,8', 'schedule']);
    expect(plugin.scheduled).toEqual([
      {
        id: 1,
        title: '<k1.title>',
        body: '<k1.body>',
        schedule: { at: new Date(1000) },
        isExactNotification: false,
      },
      {
        id: 2,
        title: '<k2.title>',
        body: '<k2.body>',
        schedule: { at: new Date(2000) },
        isExactNotification: false,
      },
    ]);
    expect(JSON.stringify(plugin.scheduled)).not.toContain('allowWhileIdle');
  });

  it('only clears the old ones for an empty plan', async () => {
    const plugin = fakePlugin({ permission: 'granted', answer: 'granted', pending: [3] });
    await new NativeNotifications(plugin, text).rescheduleAll([]);
    expect(plugin.calls).toEqual(['pending', 'cancel:3']);
  });

  it('cancels the pending and removes the shown ones', async () => {
    const plugin = fakePlugin({ permission: 'granted', answer: 'granted', pending: [4] });
    await new NativeNotifications(plugin, text).cancelAll();
    expect(plugin.calls).toEqual(['pending', 'cancel:4', 'removeDelivered']);
  });

  it('skips the cancel call when nothing is pending', async () => {
    const plugin = fakePlugin({ permission: 'granted', answer: 'granted', pending: [] });
    await new NativeNotifications(plugin, text).cancelAll();
    expect(plugin.calls).toEqual(['pending', 'removeDelivered']);
  });

  it('never throws when the plugin fails', async () => {
    const plugin = fakePlugin({
      permission: 'granted',
      answer: 'granted',
      pending: [],
      fail: true,
    });
    const service = new NativeNotifications(plugin, text);
    await expect(service.rescheduleAll([item(1, 1)])).resolves.toBeUndefined();
    await expect(service.cancelAll()).resolves.toBeUndefined();
  });
});

describe('WebNotifications', () => {
  it('has no permission and schedules nothing in a production browser', async () => {
    const lines: string[] = [];
    const web = new WebNotifications(false, (line) => lines.push(line));
    expect(await web.requestPermission()).toBe(false);
    expect(await web.hasPermission()).toBe(false);
    await web.rescheduleAll([item(1, 1)]);
    await web.cancelAll();
    expect(lines).toEqual([]);
  });

  it('pretends to be allowed once asked in development and logs the plan', async () => {
    const lines: string[] = [];
    const web = new WebNotifications(true, (line) => lines.push(line));
    expect(await web.hasPermission()).toBe(false);
    expect(await web.requestPermission()).toBe(true);
    expect(await web.hasPermission()).toBe(true);
    await web.rescheduleAll([item(1, 1)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('k1.title');
  });
});
