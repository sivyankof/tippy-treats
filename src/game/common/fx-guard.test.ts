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

  it('calls a method on its target with the arguments, and reports a failure', () => {
    const warn = vi.fn();
    const guard = new FxGuard(warn);
    const target = {
      sum: 0,
      add(a: number, b: number, c: number, d: number, e: number): void {
        this.sum += a + b + c + d + e;
      },
      boom(): void {
        throw new Error('x');
      },
    };
    expect(guard.call('add', target, target.add, 1, 2, 3, 4, 5)).toBe(true);
    expect(target.sum).toBe(15);
    expect(guard.call('boom', target, target.boom)).toBe(false);
    expect(guard.call('boom', target, target.boom)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('boom');
  });

  it('runs a cleanup under its own name and survives its failure', () => {
    const warn = vi.fn();
    const guard = new FxGuard(warn);
    const target = {
      cleaned: false,
      clean(): void {
        this.cleaned = true;
      },
      fail(): void {
        throw new Error('y');
      },
    };
    guard.cleanup('lick', target, target.clean);
    expect(target.cleaned).toBe(true);
    guard.cleanup('lick', target, target.fail);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('lick (cleanup)');
  });
  it('hands a failing effect to the reporter once per run, and survives a reporter that throws', () => {
    const reporter = vi.fn();
    const guard = new FxGuard(vi.fn());
    guard.setReporter(reporter);
    const boom = new Error('boom');
    const fail = (): void => {
      throw boom;
    };
    guard.run('smoke', fail);
    guard.run('smoke', fail);
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter).toHaveBeenCalledWith('smoke', boom);
    guard.setReporter(() => {
      throw new Error('reporter broke');
    });
    expect(() => guard.run('other', fail)).not.toThrow();
  });
});
