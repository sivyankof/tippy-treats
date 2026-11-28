import { describe, expect, it, vi } from 'vitest';
import { bindPurchasesResume } from './purchases-resume';

describe('bindPurchasesResume', () => {
  it('reconciles when the app comes back, not when it leaves; a failure is swallowed', async () => {
    const reconcile = vi.fn(() => Promise.reject(new Error('x')));
    let onActive: (active: boolean) => void = () => undefined;
    bindPurchasesResume(
      {
        onActiveChange: (cb) => {
          onActive = cb;
          return () => undefined;
        },
      },
      reconcile,
    );
    onActive(false);
    expect(reconcile).not.toHaveBeenCalled();
    onActive(true);
    expect(reconcile).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
});
