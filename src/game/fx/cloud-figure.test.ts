import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { FLIGHT_CLEAR } from '../../data/flight-clear';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import {
  bodyDisplaySize,
  cloudSilhouette,
  flightRowY,
  requiredBodyWidth,
  riseRoom,
  silhouetteBottomAt,
  silhouetteBounds,
  silhouetteTopAt,
  squashTop,
  topShare,
  type Silhouette,
} from './cloud-figure';

const cloud = RULE_ANIM.cloud;
const figure = cloud.figure;
/** Logical heights of a 390x693 and a 390x844 screen (width 1080). */
const SHORT = Math.max(LOGICAL_SIZE.minHeight, Math.round((693 * LOGICAL_SIZE.width) / 390));
const TALL = Math.round((844 * LOGICAL_SIZE.width) / 390);
/** Half of the row the cover keeps inside the body, baked px from the figure centre. */
const ROW_HALF = (BALANCE.layer.height / 2 + cloud.bobPx + figure.layerMargin) / figure.scale;
/** Lowest bottom of the HUD plates, and the plate of the next creature over the right of the row. */
const PLATES_BOTTOM = Math.max(...HUD_LAYOUT.plates.map((p) => p.y + p.height));
const NEXT_PLATE = HUD_LAYOUT.plates[5];

/** The figure as baked for a screen `screenH` tall. */
function forScreen(s: Silhouette, screenH: number): Silhouette {
  return squashTop(s, topShare(s, riseRoom(screenH)));
}

/** Screen y of the outline top of figure `s` on a screen `screenH` tall, at its highest bob and widest breath. */
function highestTop(s: Silhouette, screenH: number): number {
  const top = silhouetteBounds(s).top - figure.outline;
  const centre = flightRowY(screenH) - ANIM.flying.bobAmplitude - cloud.bobPx;
  return centre - (figure.height / 2 - top) * figure.scale * (1 + cloud.breathe);
}

/** Top edge of `s` across the screen-wide part of the body, every 2 baked px. */
function topLine(s: Silhouette): number[] {
  const tops: number[] = [];
  for (let x = figure.body.left + 70; x <= figure.body.right - 70; x += 2) {
    tops.push(silhouetteTopAt(s, x));
  }
  return tops;
}

describe('cloud figures', () => {
  it('has a body wide enough to hide a layer anywhere on the screen during the longest cover', () => {
    expect(bodyDisplaySize().width).toBeGreaterThanOrEqual(requiredBodyWidth());
  });

  it('has a body taller than the layer with room for the bob and the shake', () => {
    const need = BALANCE.layer.height + 2 * (figure.layerMargin + cloud.bobPx);
    expect(bodyDisplaySize().height).toBeGreaterThanOrEqual(need);
  });

  it('fits the shared atlas picture size and keeps its outline inside the picture', () => {
    expect(figure.width).toBeLessThanOrEqual(1024);
    expect(figure.height).toBeLessThanOrEqual(1024);
    for (const s of [cloudSilhouette()]) {
      const b = silhouetteBounds(s);
      expect(b.left - figure.outline).toBeGreaterThanOrEqual(3);
      expect(b.top - figure.outline).toBeGreaterThanOrEqual(3);
      expect(b.right + figure.outline).toBeLessThanOrEqual(figure.width - 3);
      expect(b.bottom + figure.outline).toBeLessThanOrEqual(figure.height - 3);
    }
  });

  it('draws the cloud as a lump: the top line rises well above the thin ends, the bumps differ in size', () => {
    const s = cloudSilhouette();
    const ends = Math.min(silhouetteTopAt(s, 150), silhouetteTopAt(s, 850));
    const hump = Math.min(...[480, 520, 560, 600, 640].map((x) => silhouetteTopAt(s, x)));
    expect(ends - hump).toBeGreaterThan(60);
    const radii = s.circles.map((c) => c.r);
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(2.5);
  });

  it('keeps the dip of the top line inside the spare of the body over the cover row', () => {
    expect(figure.body.top + figure.topDip).toBeLessThanOrEqual(
      figure.height / 2 - ROW_HALF + 0.01,
    );
  });

  it('keeps the full-width cover row covered on every screen height', () => {
    const rowTop = figure.height / 2 - ROW_HALF;
    const rowBottom = figure.height / 2 + ROW_HALF;
    for (const design of [cloudSilhouette()]) {
      for (const h of [SHORT, TALL, LOGICAL_SIZE.maxHeight]) {
        const s = forScreen(design, h);
        for (let x = figure.body.left + 70; x <= figure.body.right - 70; x += 4) {
          expect(silhouetteTopAt(s, x)).toBeLessThanOrEqual(rowTop + 0.01);
          expect(silhouetteBottomAt(s, x)).toBeGreaterThanOrEqual(rowBottom);
        }
      }
    }
  });
});

describe('top line on short screens', () => {
  it('keeps both figures as drawn on a 390x844 screen, the HUD gap under the plates', () => {
    for (const design of [cloudSilhouette()]) {
      expect(forScreen(design, TALL)).toBe(design);
      expect(highestTop(design, TALL)).toBeGreaterThanOrEqual(
        PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx,
      );
    }
  });

  it('squashes the top just enough wherever the screen leaves room for the HUD gap', () => {
    for (const design of [cloudSilhouette()]) {
      const least = topShare(design, -Infinity);
      for (let h = SHORT; h <= LOGICAL_SIZE.maxHeight; h += 20) {
        const share = topShare(design, riseRoom(h));
        if (share <= least) continue;
        expect(highestTop(forScreen(design, h), h)).toBeGreaterThanOrEqual(
          PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx - 0.5,
        );
      }
      // Taller screens never get a flatter top.
      expect(topShare(design, riseRoom(SHORT))).toBeLessThanOrEqual(
        topShare(design, riseRoom(TALL)),
      );
    }
  });

  it('flattens the top on 390x693 down to the cover body top, still bumpy', () => {
    expect(riseRoom(SHORT)).toBeLessThan(0);
    for (const design of [cloudSilhouette()]) {
      const flat = forScreen(design, SHORT);
      // No flat bump sticks out past the rounded ends of the body.
      const corner =
        Math.min(flat.body.bottom - flat.body.top, flat.body.right - flat.body.left) * 0.45;
      for (const c of flat.circles) {
        expect(c.x - c.r).toBeGreaterThanOrEqual(flat.body.left + corner - 0.01);
        expect(c.x + c.r).toBeLessThanOrEqual(flat.body.right - corner + 0.01);
      }
      const tops = topLine(flat);
      // The crests reach the cover body top and no higher; the valleys dip at most `topDip` into it.
      expect(Math.min(...tops)).toBeGreaterThanOrEqual(figure.body.top - 0.5);
      expect(Math.max(...tops)).toBeLessThanOrEqual(figure.body.top + figure.topDip + 0.01);
      let turns = 0;
      for (let i = 2; i < tops.length; i++) {
        const a = (tops[i - 1] ?? 0) - (tops[i - 2] ?? 0);
        const b = (tops[i] ?? 0) - (tops[i - 1] ?? 0);
        if (a * b < 0) turns++;
      }
      expect(turns).toBeGreaterThanOrEqual(8);
    }
  });

  it('leaves the HUD gap under the next creature plate on 390x693 with the figure at rest', () => {
    expect(NEXT_PLATE).toBeDefined();
    if (!NEXT_PLATE) return;
    for (const design of [cloudSilhouette()]) {
      const s = forScreen(design, SHORT);
      const restTop =
        flightRowY(SHORT) -
        (figure.height / 2 - (silhouetteBounds(s).top - figure.outline)) * figure.scale;
      expect(restTop - (NEXT_PLATE.y + NEXT_PLATE.height)).toBeGreaterThanOrEqual(
        FLIGHT_CLEAR.hudGapPx,
      );
    }
  });
});

describe('low puffs of the cloud on a short screen', () => {
  const flat = forScreen(cloudSilhouette(), SHORT);

  it('keeps puffs of clearly different size: at least 3 size classes, no two neighbours alike', () => {
    const widths = flat.circles.map((c) => c.r * 2);
    expect(widths.length).toBeGreaterThanOrEqual(6);
    const classes = new Set(widths.map((w) => (w < 70 ? 's' : w < 120 ? 'm' : 'l')));
    expect(classes.size).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < widths.length; i++) {
      expect(Math.abs((widths[i] ?? 0) - (widths[i - 1] ?? 0))).toBeGreaterThan(4);
    }
    // The heights differ too, the widest puff is the tallest.
    const heights = flat.circles.map((c) => c.ry ?? c.r);
    expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(1.5);
  });

  it('stands every puff on the drawn body top and parts neighbours by a valley down to it', () => {
    for (const c of flat.circles) expect(c.y).toBe(figure.body.top + figure.topDip);
    for (let i = 1; i < flat.circles.length; i++) {
      const a = flat.circles[i - 1];
      const b = flat.circles[i];
      if (!a || !b) continue;
      expect(b.x - b.r).toBeGreaterThanOrEqual(a.x + a.r - 1.01);
    }
  });

  it('keeps the drawn figure on tall screens', () => {
    expect(topShare(cloudSilhouette(), riseRoom(TALL))).toBe(1);
  });
});
