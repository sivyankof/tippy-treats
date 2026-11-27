import { describe, expect, it, vi } from 'vitest';
import { ScreenAdWatch } from './screen-ad';

/** An ad the test closes by hand with the given result. */
function pendingAd<T>() {
  let finish: (result: T) => void = () => {};
  const shown = new Promise<T>((resolve) => (finish = resolve));
  return { show: () => shown, finish };
}

describe('ScreenAdWatch', () => {
  it.each(['rewarded', 'cancelled', 'unavailable'])(
    'is showing only while the ad is on and tells the waiting callback after a %s ad',
    async (outcome) => {
      const watch = new ScreenAdWatch();
      const ad = pendingAd<string>();
      const order: string[] = [];
      const done = watch.run(
        ad.show,
        () => true,
        (result) => order.push(`apply ${result}`),
      );
      expect(watch.showing()).toBe(true);
      watch.onceClosed(() => order.push('closed'));
      ad.finish(outcome);
      await done;
      expect(watch.showing()).toBe(false);
      expect(order).toEqual([`apply ${outcome}`, 'closed']);
    },
  );

  it('ignores a wait with no ad on, so a later ad does not call it', async () => {
    const watch = new ScreenAdWatch();
    const callback = vi.fn();
    watch.onceClosed(callback);
    await watch.run(
      () => Promise.resolve('cancelled'),
      () => true,
      () => {},
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('calls the waiting callback once, not again after the next ad', async () => {
    const watch = new ScreenAdWatch();
    const callback = vi.fn();
    const first = pendingAd<string>();
    const done = watch.run(
      first.show,
      () => true,
      () => {},
    );
    watch.onceClosed(callback);
    first.finish('cancelled');
    await done;
    await watch.run(
      () => Promise.resolve('cancelled'),
      () => true,
      () => {},
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('still tells the waiting callback when applying the result throws', async () => {
    const watch = new ScreenAdWatch();
    const callback = vi.fn();
    const ad = pendingAd<string>();
    const done = watch.run(
      ad.show,
      () => true,
      () => {
        throw new Error('boom');
      },
    );
    watch.onceClosed(callback);
    ad.finish('rewarded');
    await expect(done).rejects.toThrow('boom');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(watch.showing()).toBe(false);
  });

  it('applies nothing and drops the callback when the screen is gone', async () => {
    const watch = new ScreenAdWatch();
    const callback = vi.fn();
    const apply = vi.fn();
    const ad = pendingAd<string>();
    const done = watch.run(ad.show, () => false, apply);
    watch.onceClosed(callback);
    ad.finish('rewarded');
    await done;
    expect(apply).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});
