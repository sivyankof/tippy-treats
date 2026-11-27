import { describe, expect, it, vi } from 'vitest';
import { logMapOpen } from './climb-map-telemetry';

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../services', () => ({ services: { telemetry: { logEvent } } }));

describe('climb map events', () => {
  it('logs map_open with no parameters', () => {
    logMapOpen();
    expect(logEvent.mock.calls).toEqual([['map_open']]);
  });
});
