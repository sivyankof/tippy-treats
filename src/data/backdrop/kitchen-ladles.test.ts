import { describe, expect, it } from 'vitest';
import { DEG_TO_RAD, sineWave } from '../../util/math';
import { BACKDROP_LIFE } from './backdrop-life';

/** Width of the bowl of a ladle picture, and the distance from its pivot to the middle of the bowl (px at scale 1). */
const BOWL_WIDTH = 46;
const PIVOT_TO_BOWL = 208;
/** Width of the screen is 1080; the rail hangs in the right outer column. */
const SCREEN_W = 1080;
/** The panoramic window's right frame edge on 390x844 (centre 540, half the picture 320). */
const WINDOW_EDGE = 540 + 320;

describe('kitchen ladles on the rail', () => {
  const ladles = BACKDROP_LIFE.kitchen.ladles;

  it('never touch their neighbours at any swing phase', () => {
    const xs = ladles.map((l) => l.offset?.x ?? 0);
    for (let t = 0; t < 120000; t += 20) {
      const tips = ladles.map((l, i) => {
        const scale = l.scale ?? 1;
        const swing = l.swing;
        const angle = swing ? swing.deg * sineWave(t, swing.ms, l.phase ?? 0) * DEG_TO_RAD : 0;
        return {
          x: (xs[i] ?? 0) + PIVOT_TO_BOWL * scale * Math.sin(angle),
          half: (BOWL_WIDTH * scale) / 2,
        };
      });
      for (let i = 1; i < tips.length; i++) {
        const a = tips[i - 1];
        const b = tips[i];
        if (!a || !b) continue;
        expect(b.x - a.x - a.half - b.half).toBeGreaterThan(0);
      }
    }
  });

  it('hang on the rail, clear of the window frame and inside the screen', () => {
    const rail = BACKDROP_LIFE.kitchen.rail;
    const scale = rail.scale ?? 1;
    const centre = rail.at.x * SCREEN_W;
    const half = (230 * scale) / 2;
    expect(centre - half - WINDOW_EDGE).toBeGreaterThanOrEqual(20);
    expect(centre + half).toBeLessThanOrEqual(SCREEN_W);
  });
});
