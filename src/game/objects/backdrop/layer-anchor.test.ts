import { describe, expect, it } from 'vitest';
import { ANIM } from '../../../data/common/anim';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { WALL_LOOK, WINDOW_LOOK } from '../../../data/weather/window-look';
import {
  copyMirrored,
  fillLayerFrame,
  layerDownAt,
  layerPoint,
  layerSwayAt,
  newLayerFrame,
  seriesRise,
  slotCopy,
  type LayerSeries,
} from './layer-anchor';
import { BACKDROP } from '../../../data/backdrop/backdrop';
import { ZONES } from '../../../data/zones/zones';

const HEIGHTS = [LOGICAL_SIZE.minHeight, 2340, LOGICAL_SIZE.maxHeight];

/** Copies of a series that show at least a sliver on a screen `height` tall (`half` px around a centre). */
function shown(series: LayerSeries, y0: number, down: number, height: number, half: number) {
  const out: { n: number; y: number }[] = [];
  for (let slot = 0; slot < series.pool; slot++) {
    const n = slotCopy(slot, series, y0, down, height);
    const y = y0 + down - seriesRise(n, series, height);
    if (y + half > 0 && y - half < height) out.push({ n, y });
  }
  return out;
}

describe('layerPoint', () => {
  it('follows a point of the layer texture in every zone and layer: the same shift for any scroll and time', () => {
    const origin = 500;
    const out = { x: 0, y: 0 };
    const frame = newLayerFrame();
    for (const zone of ZONES) {
      BACKDROP.sway[zone.id].forEach((sway, layer) => {
        if (!sway) return;
        const parallax = ANIM.parallax[layer] ?? 1;
        for (const scrollY of [500, 320, -40, -900]) {
          for (const timeMs of [0, 3100, 7300, 12000, 19999]) {
            // A texture point drawn at (ax, ay) on the start view is at (tx - tileX, ty - tileY) later.
            const [ax, ay] = [900, 1260];
            const [tx, ty] = [ax, ay + origin * parallax];
            const tileY = scrollY * parallax;
            const tileX = layerSwayAt(zone.id, layer, timeMs) ?? NaN;
            fillLayerFrame(frame, zone.id, scrollY, origin, timeMs);
            layerPoint(ax, ay, frame, layer, out);
            expect(out.y).toBeCloseTo(ty - tileY, 6);
            // Sideways it sways with the texture, so it never slides against it.
            expect(out.x).toBeCloseTo(tx - tileX, 6);
          }
        }
      });
    }
  });

  it('does not move before the camera leaves its start view, and the sway is 0 at the start', () => {
    for (let layer = 0; layer < 4; layer++) {
      expect(layerDownAt(layer, 500, 500)).toBe(0);
      expect(layerDownAt(layer, 400, 500)).toBeCloseTo(100 * (ANIM.parallax[layer] ?? 1), 6);
    }
    for (const zone of ZONES) {
      BACKDROP.sway[zone.id].forEach((sway, layer) => {
        if (sway) expect(layerSwayAt(zone.id, layer, 0)).toBe(0);
      });
    }
  });
});

describe('layerSwayAt', () => {
  it('stays within the amplitude and returns after one period', () => {
    for (const zone of ZONES) {
      BACKDROP.sway[zone.id].forEach((sway, layer) => {
        if (!sway) {
          expect(layerSwayAt(zone.id, layer, 100)).toBeNull();
          return;
        }
        for (let t = 0; t < 2 * sway.periodMs; t += 137) {
          expect(Math.abs(layerSwayAt(zone.id, layer, t) ?? NaN)).toBeLessThanOrEqual(
            sway.px + 1e-9,
          );
          expect(layerSwayAt(zone.id, layer, t + sway.periodMs)).toBeCloseTo(
            layerSwayAt(zone.id, layer, t) ?? NaN,
            6,
          );
        }
      });
    }
  });
});

describe('layer sway and the idle limit', () => {
  it('never stands still for 2 s: even over a turning point it moves more than the 0.6 px the audit counts', () => {
    for (const zone of ZONES) {
      for (const sway of BACKDROP.sway[zone.id]) {
        if (!sway) continue;
        const moved = sway.px * (1 - Math.cos((2 * Math.PI * 1000) / sway.periodMs));
        expect(moved).toBeGreaterThan(0.6);
      }
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
