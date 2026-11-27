import { describe, expect, it, vi } from 'vitest';
import { logJournalOpen } from './journal-telemetry';

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../services', () => ({ services: { telemetry: { logEvent } } }));

describe('journal events', () => {
  it('logs journal_open with no parameters', () => {
    logJournalOpen();
    expect(logEvent.mock.calls).toEqual([['journal_open']]);
  });
});
