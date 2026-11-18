import { describe, expect, it } from 'vitest';
import { PANORAMA, WINDOW_LOOK } from '../../../data/window-look';
import { detailScale } from './window-paint';

describe('detailScale', () => {
  it('is 1 on the small window and never drops below 1 on a bigger pane', () => {
    expect(detailScale(WINDOW_LOOK.glass.h)).toBe(1);
    let last = 1;
    for (let h = WINDOW_LOOK.glass.h; h <= 600; h += 5) {
      const k = detailScale(h);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
    }
  });

  it('keeps the panorama look: about 2.1 for its glass', () => {
    expect(detailScale(PANORAMA.glass.h)).toBeCloseTo(
      (PANORAMA.glass.h / WINDOW_LOOK.glass.h) * 0.8,
    );
  });
});
