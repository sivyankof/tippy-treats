import { describe, expect, it, vi } from 'vitest';
import { bindVideoWake } from './video-wake';

describe('bindVideoWake', () => {
  it('wakes the ads when the app returns and when the network comes back', () => {
    const wake = vi.fn();
    let onActive: (active: boolean) => void = () => undefined;
    const handlers = new Map<string, () => void>();
    bindVideoWake(
      { wake },
      {
        onActiveChange: (cb) => {
          onActive = cb;
          return () => undefined;
        },
      },
      { addEventListener: ((type: string, cb: () => void) => handlers.set(type, cb)) as never },
    );
    onActive(false);
    expect(wake).not.toHaveBeenCalled();
    onActive(true);
    handlers.get('online')?.();
    expect(wake).toHaveBeenCalledTimes(2);
  });
});
