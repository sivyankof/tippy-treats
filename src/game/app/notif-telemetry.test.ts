import { describe, expect, it, vi } from 'vitest';
import { logNotifPermission } from './notif-telemetry';

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('../../services', () => ({ services: { telemetry: { logEvent } } }));

describe('logNotifPermission', () => {
  it('logs the answer', () => {
    logNotifPermission(true);
    logNotifPermission(false);
    expect(logEvent.mock.calls).toEqual([
      ['notif_permission', { granted: true }],
      ['notif_permission', { granted: false }],
    ]);
  });
});
