import { describe, expect, it } from 'vitest';
import { ANIM } from '../../../data/anim';
import { LOGICAL_SIZE } from '../../../data/screen';
import { WALL_LOOK, WINDOW_LOOK } from '../../../data/window-look';
import {
  copyMirrored,
  seriesRise,
  slotCopy,
  wallDownAt,
  wallDriftX,
  wallSwayX,
  wallPoint,
  type WallSeries,
} from './wall-anchor';

const HEIGHTS = [LOGICAL_SIZE.minHeight, 2340, LOGICAL_SIZE.maxHeight];
const parallax = ANIM.parallax[WALL_LOOK.layer] ?? 1;

/** Copies of a series that show at least a sliver on a screen `height` tall (`half` px around a centre). */
function shown(series: WallSeries, y0: number, wallDown: number, height: number, half: number) {
  const out: { n: number; y: number }[] = [];
  for (let slot = 0; slot < series.pool; slot++) {
    const n = slotCopy(slot, series, y0, wallDown, height);
    const y = y0 + wallDown - seriesRise(n, series, height);
    if (y + half > 0 && y - half < height) out.push({ n, y });
  }
  return out;
}

describe('wallPoint', () => {
  it('follows a point of the layer texture: the same shift for any scroll and time', () => {
    const startScroll = 500;
    const out = { x: 0, y: 0 };
    for (const scrollY of [500, 320, -40, -900]) {
      for (const timeMs of [0, 3100, 7300, 12000, 19999]) {
        // A texture point drawn at (ax, ay) on the start view is at (tx - tileX, ty - tileY) later.
        const [ax, ay] = [900, 1260];
        const [tx, ty] = [ax, ay + startScroll * parallax];
        const tileY = scrollY * parallax;
        const tileX = wallSwayX(timeMs);
        wallPoint(ax, ay, wallDownAt(scrollY, startScroll), timeMs, out);
        expect(out.y).toBeCloseTo(ty - tileY, 6);
        // Sideways it sways with the texture, so it never slides against it.
        expect(out.x).toBeCloseTo(tx - tileX, 6);
        expect(out.x).toBeCloseTo(ax + wallDriftX(timeMs), 6);
      }
    }
  });

  it('does not move before the camera leaves its start view', () => {
    expect(wallDownAt(500, 500)).toBe(0);
    expect(wallDownAt(400, 500)).toBeCloseTo(100 * parallax, 6);
  });
});

describe('wallSwayX', () => {
  it('stays within the amplitude and returns after one period', () => {
    const { px, periodMs } = WALL_LOOK.sway;
    for (let t = 0; t < 2 * periodMs; t += 137) {
      expect(Math.abs(wallSwayX(t))).toBeLessThanOrEqual(px + 1e-9);
      expect(wallSwayX(t + periodMs)).toBeCloseTo(wallSwayX(t), 6);
    }
  });
});

describe('slotCopy', () => {
  const win = WALL_LOOK.window;
  const half = WINDOW_LOOK.height / 2;
  for (const height of HEIGHTS) {
    const y0 = WINDOW_LOOK.kitchen.at.y * height;

    it(`shows the start window first and at most two windows at once (${height})`, () => {
      expect(shown(win, y0, 0, height, half)).toEqual([{ n: 0, y: y0 }]);
      for (let down = 0; down < 12 * height; down += 7) {
        expect(shown(win, y0, down, height, half).length).toBeLessThanOrEqual(2);
      }
    });

    it(`hands over from one window to the next, on the other side (${height})`, () => {
      let last = -1;
      for (let down = 0; down < 8 * height; down += 5) {
        for (const { n } of shown(win, y0, down, height, half)) {
          if (n !== last) {
            if (last >= 0) expect(n).toBe(last + 1);
            last = n;
          }
        }
      }
      expect(copyMirrored(0)).toBe(false);
      expect(copyMirrored(1)).toBe(true);
    });

    it(`keeps jar, sweets and display clear of every window (${height})`, () => {
      for (const item of [WALL_LOOK.jar, WALL_LOOK.sweets, WALL_LOOK.display]) {
        for (let n = 1; n < 12; n++) {
          for (let k = 0; k < 40; k++) {
            const away = Math.abs(seriesRise(n, item, height) - seriesRise(k, win, height));
            expect(away).toBeGreaterThan(0.4 * height);
          }
        }
      }
    });
  }
});
