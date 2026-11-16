import { describe, expect, it, vi } from 'vitest';
import { FxGuard } from './fx-guard';

describe('FxGuard', () => {
  it('runs a healthy effect without a warning', () => {
    const warn = vi.fn();
    const fn = vi.fn();
    new FxGuard(warn).run('ok', fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it('swallows a failure and names the effect', () => {
    const warn = vi.fn();
    const boom = new Error('boom');
    new FxGuard(warn).run('sparkles', () => {
      throw boom;
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('sparkles');
    expect(warn.mock.calls[0]?.[1]).toBe(boom);
  });

  it('warns once per name, again for another name and after a reset', () => {
    const warn = vi.fn();
    const guard = new FxGuard(warn);
    const fail = (): void => {
      throw new Error('x');
    };
    for (let i = 0; i < 100; i++) guard.run('a', fail);
    expect(warn).toHaveBeenCalledTimes(1);
    guard.run('b', fail);
    expect(warn).toHaveBeenCalledTimes(2);
    guard.reset();
    guard.run('a', fail);
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('calls the cleanup on failure, and survives a failing cleanup', () => {
    const warn = vi.fn();
    const guard = new FxGuard(warn);
    const cleanup = vi.fn();
    guard.run(
      'lick',
      () => {
        throw new Error('x');
      },
      cleanup,
    );
    expect(cleanup).toHaveBeenCalledOnce();
    guard.run(
      'lick2',
      () => {
        throw new Error('x');
      },
      () => {
        throw new Error('y');
      },
    );
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('gives the fallback when a value effect throws', () => {
    const guard = new FxGuard(vi.fn());
    expect(guard.value('v', () => 5, 0)).toBe(5);
    expect(
      guard.value(
        'v2',
        () => {
          throw new Error('x');
        },
        7,
      ),
    ).toBe(7);
  });
});
