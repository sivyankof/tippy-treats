import { describe, expect, it } from 'vitest';
import { PANORAMA, WINDOW_LOOK } from '../../../../data/weather/window-look';
import { detailScale, moonSpot } from './window-paint';

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

describe('moonSpot', () => {
  it('stands clear of the middle bar of the panoramic window', () => {
    const glass = PANORAMA.glass;
    const moon = moonSpot(glass);
    expect(moon.x - moon.r).toBeGreaterThan(glass.x + glass.w / 2 + PANORAMA.barPx / 2);
  });
  it('stands inside the glass, mirrored to the other half', () => {
    for (const glass of [WINDOW_LOOK.glass, PANORAMA.glass]) {
      const moon = moonSpot(glass);
      expect(moon.x + moon.r).toBeLessThan(glass.x + glass.w);
      expect(moon.y - moon.r).toBeGreaterThan(glass.y);
      expect(moonSpot(glass, true).x).toBeCloseTo(glass.x + glass.w - (moon.x - glass.x));
    }
  });
});
