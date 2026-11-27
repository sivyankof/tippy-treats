import { describe, expect, it } from 'vitest';
import { MENU } from '../../../data/common/menu-layout';
import { popupReserve, popupRoom } from './window-fit';

describe('popup fit', () => {
  const half = MENU.style.ribbon.height / 2;

  it('keeps half the ribbon under an island and the whole ribbon elsewhere', () => {
    expect(popupReserve(100)).toBe(half);
    expect(popupReserve(0)).toBe(half * 2);
  });

  it('leaves the screen margins and the reserve out of the room', () => {
    expect(popupRoom(2000, 0)).toBe(2000 - MENU.popup.screenMargin * 2 - half * 2);
  });
});
