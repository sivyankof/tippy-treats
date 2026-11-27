import { describe, expect, it } from 'vitest';
import { ScreenCover } from './screen-cover';

function part(visible = true, active = true) {
  const item = {
    visible,
    active,
    setVisible(value: boolean) {
      item.visible = value;
      return item;
    },
  };
  return item;
}

describe('ScreenCover', () => {
  it('hides the parts and shows them again', () => {
    const cover = new ScreenCover();
    const a = part();
    const b = part();
    cover.hide([a, b, { y: 1 }, null]);
    expect([a.visible, b.visible, cover.covering]).toEqual([false, false, true]);
    cover.restore();
    expect([a.visible, b.visible, cover.covering]).toEqual([true, true, false]);
  });

  it('keeps a part hidden that was hidden before', () => {
    const cover = new ScreenCover();
    const shy = part(false);
    cover.hide([shy]);
    cover.restore();
    expect(shy.visible).toBe(false);
  });

  it('does not hide twice, so the first memory holds', () => {
    const cover = new ScreenCover();
    const a = part();
    cover.hide([a]);
    cover.hide([a]);
    cover.restore();
    expect(a.visible).toBe(true);
  });

  it('leaves a destroyed part alone and restore without hide does nothing', () => {
    const cover = new ScreenCover();
    cover.restore();
    const gone = part(true, true);
    cover.hide([gone]);
    gone.active = false;
    cover.restore();
    expect(gone.visible).toBe(false);
  });
});
