import { describe, expect, it } from 'vitest';
import { now } from './clock';

describe('now', () => {
  it('is the system time without a window', () => {
    const before = Date.now();
    const value = now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value - before).toBeLessThan(1000);
  });
});
