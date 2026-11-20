import { describe, expect, it, vi } from 'vitest';
import { bindPlayDays } from './play-days';

describe('bindPlayDays', () => {
  function setup() {
    const state = { notePlayDay: vi.fn() };
    let active: (on: boolean) => void = () => undefined;
    const shell = {
      onActiveChange: (callback: (on: boolean) => void) => {
        active = callback;
        return () => undefined;
      },
    };
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as const });
    bindPlayDays(state, shell, doc);
    return { state, active: (on: boolean) => active(on), doc };
  }

  it('counts the launch', () => {
    expect(setup().state.notePlayDay).toHaveBeenCalledTimes(1);
  });

  it('counts the app coming back to the front, not going away', () => {
    const { state, active } = setup();
    active(false);
    expect(state.notePlayDay).toHaveBeenCalledTimes(1);
    active(true);
    expect(state.notePlayDay).toHaveBeenCalledTimes(2);
  });

  it('counts the page becoming visible, not hidden', () => {
    const { state, doc } = setup();
    Object.assign(doc, { visibilityState: 'hidden' });
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(state.notePlayDay).toHaveBeenCalledTimes(1);
    Object.assign(doc, { visibilityState: 'visible' });
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(state.notePlayDay).toHaveBeenCalledTimes(2);
  });
});
