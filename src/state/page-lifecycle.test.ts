import { describe, expect, it, vi } from 'vitest';
import { bindPageLeave } from './page-lifecycle';

function persisted(persistedFlag: boolean): Event {
  return Object.assign(new Event('pageshow'), { persisted: persistedFlag });
}

function setup() {
  const win = new EventTarget();
  const onLeave = vi.fn();
  const onRestore = vi.fn();
  const unbind = bindPageLeave(onLeave, onRestore, win as unknown as Window);
  return { win, onLeave, onRestore, unbind };
}

describe('bindPageLeave', () => {
  it('counts pagehide as a leave', () => {
    const { win, onLeave } = setup();
    win.dispatchEvent(new Event('pagehide'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh run only when the page returns from the cache after a leave', () => {
    const { win, onRestore } = setup();
    win.dispatchEvent(persisted(true));
    expect(onRestore).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('pagehide'));
    win.dispatchEvent(persisted(false));
    expect(onRestore).not.toHaveBeenCalled();
    win.dispatchEvent(persisted(true));
    expect(onRestore).toHaveBeenCalledTimes(1);
    win.dispatchEvent(persisted(true));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('stops listening after unbind', () => {
    const { win, onLeave, unbind } = setup();
    unbind();
    win.dispatchEvent(new Event('pagehide'));
    expect(onLeave).not.toHaveBeenCalled();
  });
});
