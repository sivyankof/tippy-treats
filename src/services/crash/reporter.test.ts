import { describe, expect, it, vi } from 'vitest';
import { CrashReporter, installErrorHandlers, type ErrorTarget } from './reporter';

function make() {
  const recordError = vi.fn();
  const service = { recordError, crash: vi.fn() };
  const reporter = new CrashReporter(service, { scene: () => 'game', saveVersion: () => 10 });
  return { recordError, reporter };
}

function errorWithStack(message: string, line: number): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at f (a.js:${line}:1)`;
  return error;
}

describe('CrashReporter', () => {
  it('reports a failure with the scene and the save version', () => {
    const { recordError, reporter } = make();
    const error = new Error('boom');
    reporter.reportFailure(error, 'error');
    expect(recordError).toHaveBeenCalledWith(error, {
      scene: 'game',
      saveVersion: 10,
      kind: 'error',
    });
  });

  it('reports a loop stall with its own kind, even twice', () => {
    const { recordError, reporter } = make();
    reporter.reportLoopStall('restart');
    reporter.reportLoopStall('restart');
    reporter.reportLoopStall('give-up');
    expect(recordError.mock.calls.map((call) => call[1].kind)).toEqual([
      'loop-stall',
      'loop-stall',
      'loop-stall-gave-up',
    ]);
  });

  it('does not report the same failure twice', () => {
    const { recordError, reporter } = make();
    reporter.reportFailure(errorWithStack('same', 1), 'error');
    reporter.reportFailure(errorWithStack('same', 1), 'rejection');
    reporter.reportFailure(errorWithStack('same', 2), 'error');
    expect(recordError).toHaveBeenCalledTimes(2);
  });

  it('stops after the limit of one page load', () => {
    const { recordError, reporter } = make();
    for (let i = 0; i < 40; i++) reporter.reportFailure(`failure ${i}`, 'error');
    expect(recordError).toHaveBeenCalledTimes(25);
  });

  it('ignores the harmless browser messages', () => {
    const { recordError, reporter } = make();
    reporter.reportFailure(
      'ResizeObserver loop completed with undelivered notifications.',
      'error',
    );
    reporter.reportFailure('Script error.', 'error');
    expect(recordError).not.toHaveBeenCalled();
  });

  it('reports an effect once per name and a few effects in all', () => {
    const { recordError, reporter } = make();
    reporter.reportEffect('smoke', new Error('a'));
    reporter.reportEffect('smoke', new Error('b'));
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(recordError.mock.calls[0]?.[1]).toMatchObject({ kind: 'effect:smoke' });
    for (let i = 0; i < 20; i++) reporter.reportEffect(`fx${i}`, new Error(`e${i}`));
    expect(recordError).toHaveBeenCalledTimes(8);
  });

  it('survives a service and a source that throw', () => {
    const throwing = new CrashReporter(
      {
        recordError: () => {
          throw new Error('x');
        },
        crash: vi.fn(),
      },
      { scene: () => 'game', saveVersion: () => 1 },
    );
    expect(() => throwing.reportFailure('a', 'error')).not.toThrow();
    const brokenSource = new CrashReporter(
      { recordError: vi.fn(), crash: vi.fn() },
      {
        scene: () => {
          throw new Error('no scene');
        },
        saveVersion: () => 1,
      },
    );
    expect(() => brokenSource.reportFailure('b', 'error')).not.toThrow();
  });

  it('sends the test report past the limits', () => {
    const { recordError, reporter } = make();
    reporter.reportTest();
    reporter.reportTest();
    expect(recordError).toHaveBeenCalledTimes(2);
    expect(recordError.mock.calls[0]?.[1]).toMatchObject({ kind: 'test' });
  });
});

describe('installErrorHandlers', () => {
  function fakeWindow() {
    const handlers: Record<string, (event: never) => void> = {};
    const target = {
      addEventListener: (type: string, listener: (event: never) => void) => {
        handlers[type] = listener;
      },
    } as unknown as ErrorTarget;
    return { target, handlers };
  }

  it('reports window errors and unhandled rejections', () => {
    const { recordError, reporter } = make();
    const { target, handlers } = fakeWindow();
    installErrorHandlers(target, reporter);
    handlers.error?.({ error: new Error('uncaught'), message: 'uncaught' } as never);
    handlers.unhandledrejection?.({ reason: new Error('rejected') } as never);
    expect(recordError).toHaveBeenCalledTimes(2);
    expect(recordError.mock.calls[1]?.[1]).toMatchObject({ kind: 'rejection' });
  });

  it('falls back to the message when there is no error object, and skips empty events', () => {
    const { recordError, reporter } = make();
    const { target, handlers } = fakeWindow();
    installErrorHandlers(target, reporter);
    handlers.error?.({ message: 'Something broke' } as never);
    handlers.error?.({} as never);
    expect(recordError).toHaveBeenCalledTimes(1);
  });
});
