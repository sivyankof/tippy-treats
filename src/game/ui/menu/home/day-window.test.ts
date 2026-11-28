import { describe, expect, it } from 'vitest';
import { pickDayWindow, type DayWindowInput } from './day-window';

const all: DayWindowInput = {
  firstHome: false,
  askShown: false,
  streakPending: true,
  ovenPending: true,
  offerPending: true,
};

describe('pickDayWindow', () => {
  it('opens nothing on the first Home, whatever is waiting', () => {
    expect(pickDayWindow({ ...all, firstHome: true })).toBeNull();
  });

  it('opens nothing on an entry that already showed a question', () => {
    expect(pickDayWindow({ ...all, askShown: true })).toBeNull();
  });

  it('opens one window on the second entry: the streak first', () => {
    expect(pickDayWindow(all)).toBe('streak');
  });

  it('gives the pending windows one per entry in the order streak, oven, offer', () => {
    const state = { ...all };
    const order: (string | null)[] = [];
    for (let entry = 0; entry < 4; entry += 1) {
      const picked = pickDayWindow(state);
      order.push(picked);
      if (picked === 'streak') state.streakPending = false;
      if (picked === 'oven') state.ovenPending = false;
      if (picked === 'offer') state.offerPending = false;
    }
    expect(order).toEqual(['streak', 'oven', 'offer', null]);
  });

  it('skips what is not pending', () => {
    expect(pickDayWindow({ ...all, streakPending: false })).toBe('oven');
    expect(pickDayWindow({ ...all, streakPending: false, ovenPending: false })).toBe('offer');
    expect(
      pickDayWindow({ ...all, streakPending: false, ovenPending: false, offerPending: false }),
    ).toBeNull();
  });
});
