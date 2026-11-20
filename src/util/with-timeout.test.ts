import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './with-timeout';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
  it('passes the value through', async () => {
    await expect(withTimeout(Promise.resolve(3), 1000)).resolves.toBe(3);
  });

  it('passes a rejection through', async () => {
    await expect(withTimeout(Promise.reject(new Error('bad')), 1000)).rejects.toThrow('bad');
  });

  it('rejects when the promise is too slow', async () => {
    vi.useFakeTimers();
    const slow = withTimeout(new Promise<number>(() => undefined), 500);
    const caught = expect(slow).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(500);
    await caught;
  });
});
