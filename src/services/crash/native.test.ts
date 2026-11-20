import { describe, expect, it, vi } from 'vitest';
import { NativeCrash, type CrashPlugin } from './native';
import { WebCrash } from './web';

const CONTEXT = { scene: 'game', saveVersion: 10, kind: 'error' };

function fakePlugin() {
  return {
    recordException: vi.fn(() => Promise.resolve()),
    setCustomKey: vi.fn(() => Promise.resolve()),
    crash: vi.fn(() => Promise.resolve()),
  } satisfies CrashPlugin;
}

describe('NativeCrash', () => {
  it('sets the scene and the save version, then records the error with its frames', () => {
    const plugin = fakePlugin();
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at tower (a/b/index.js:4:2)';
    new NativeCrash(plugin).recordError(error, CONTEXT);
    expect(plugin.setCustomKey).toHaveBeenCalledWith({
      key: 'scene',
      value: 'game',
      type: 'string',
    });
    expect(plugin.setCustomKey).toHaveBeenCalledWith({
      key: 'save_version',
      value: 10,
      type: 'int',
    });
    expect(plugin.recordException).toHaveBeenCalledWith({
      message: 'Error: boom',
      stacktrace: [{ functionName: 'tower', fileName: 'index.js', lineNumber: 4 }],
    });
  });

  it('records a thrown string without a stack', () => {
    const plugin = fakePlugin();
    new NativeCrash(plugin).recordError('oops', { ...CONTEXT, scene: '' });
    expect(plugin.recordException).toHaveBeenCalledWith({ message: 'oops' });
    expect(plugin.setCustomKey).toHaveBeenCalledWith({
      key: 'scene',
      value: 'none',
      type: 'string',
    });
  });

  it('forces a crash for the debug menu', () => {
    const plugin = fakePlugin();
    new NativeCrash(plugin).crash();
    expect(plugin.crash).toHaveBeenCalledOnce();
  });

  it('never throws and never leaves a rejection behind', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const rejecting: CrashPlugin = {
      recordException: () => Promise.reject(new Error('x')),
      setCustomKey: () => Promise.reject(new Error('x')),
      crash: () => Promise.reject(new Error('x')),
    };
    const throwing: CrashPlugin = {
      recordException: () => {
        throw new Error('x');
      },
      setCustomKey: () => {
        throw new Error('x');
      },
      crash: () => {
        throw new Error('x');
      },
    };
    for (const plugin of [rejecting, throwing]) {
      const crash = new NativeCrash(plugin);
      expect(() => crash.recordError(new Error('e'), CONTEXT)).not.toThrow();
      expect(() => crash.crash()).not.toThrow();
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('WebCrash', () => {
  it('prints in dev and is silent in production', () => {
    const sink = vi.fn();
    new WebCrash(true, sink).recordError(new Error('boom'), CONTEXT);
    expect(sink).toHaveBeenCalledWith('[crash] error (game)', 'Error: boom');
    const quiet = vi.fn();
    new WebCrash(false, quiet).recordError(new Error('boom'), CONTEXT);
    expect(quiet).not.toHaveBeenCalled();
  });
});
