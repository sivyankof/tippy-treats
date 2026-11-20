import { describe, expect, it } from 'vitest';
import { fireAndForget, ignore } from './fire-and-forget';

describe('fireAndForget', () => {
  it('runs the call', () => {
    let ran = false;
    fireAndForget(() => {
      ran = true;
      return Promise.resolve();
    });
    expect(ran).toBe(true);
  });

  it('drops a rejection and a throw at once', async () => {
    fireAndForget(() => Promise.reject(new Error('blocked')));
    expect(() =>
      fireAndForget(() => {
        throw new Error('plugin missing');
      }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it('ignore returns nothing', () => {
    expect(ignore()).toBeUndefined();
  });
});
