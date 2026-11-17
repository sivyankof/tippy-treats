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
  curlPictureSize,
  flightRowY,
  nebulaSilhouette,
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
    for (const s of [cloudSilhouette(), nebulaSilhouette()]) {
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
    for (const design of [cloudSilhouette(), nebulaSilhouette()]) {
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
    for (const design of [cloudSilhouette(), nebulaSilhouette()]) {
      expect(forScreen(design, TALL)).toBe(design);
      expect(highestTop(design, TALL)).toBeGreaterThanOrEqual(
        PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx,
      );
    }
  });

  it('squashes the top just enough wherever the screen leaves room for the HUD gap', () => {
    for (const design of [cloudSilhouette(), nebulaSilhouette()]) {
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
    for (const design of [cloudSilhouette(), nebulaSilhouette()]) {
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
    for (const design of [cloudSilhouette(), nebulaSilhouette()]) {
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

describe('nebula look', () => {
  it('has a bumpy cotton top: no straight run, valleys above the drawn body, puffier than its underside', () => {
    const s = nebulaSilhouette();
    let run = 0;
    let longest = 0;
    for (let x = figure.body.left + 40; x <= figure.body.right - 40; x++) {
      const top = silhouetteTopAt(s, x);
      run = Math.abs(top - silhouetteTopAt(s, x - 1)) < 0.05 ? run + 1 : 0;
      longest = Math.max(longest, run);
      expect(top).toBeLessThan(s.body.top);
    }
    expect(longest).toBeLessThan(6);
    let rise = 0;
    let sag = 0;
    for (let x = 160; x <= 840; x += 4) {
      rise += figure.body.top - silhouetteTopAt(s, x);
      sag += silhouetteBottomAt(s, x) - figure.body.bottom;
    }
    expect(rise).toBeGreaterThan(sag);
    const radii = s.circles.map((c) => c.r);
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.8);
  });

  it('is a band of about one thickness: the middle is at most 1.3 times as thick as the ends', () => {
    const s = nebulaSilhouette();
    const thick = (x: number): number => silhouetteBottomAt(s, x) - silhouetteTopAt(s, x);
    const ends = Math.min(thick(150), thick(850));
    let middle = 0;
    for (let x = 300; x <= 700; x += 4) middle = Math.max(middle, thick(x));
    expect(middle / ends).toBeLessThanOrEqual(1.3);
    // Nothing hangs: the underside is almost flat (within a few px of the body bottom).
    for (let x = 160; x <= 880; x += 4) {
      expect(silhouetteBottomAt(s, x) - figure.body.bottom).toBeLessThanOrEqual(12);
    }
  });

  it('has 3 or 4 short soft wisps of different length: a few lobes, smaller and fainter, not a column', () => {
    const wisps = nebulaSilhouette().wisps ?? [];
    expect(wisps.length).toBeGreaterThanOrEqual(3);
    expect(wisps.length).toBeLessThanOrEqual(4);
    const lens = wisps.map((w) => {
      const last = w.tail[w.tail.length - 1];
      return last ? last.y + (last.ry ?? last.r) - figure.body.bottom : 0;
    });
    expect(new Set(lens.map((l) => Math.round(l))).size).toBe(wisps.length);
    // Short: no more than 40 baked px (about 20 CSS px on a phone) under the body.
    expect(Math.max(...lens)).toBeLessThanOrEqual(40);
    for (const w of wisps) {
      expect(w.tail.length).toBeGreaterThanOrEqual(2);
      expect(w.tail.length).toBeLessThanOrEqual(3);
      const alphas = w.tail.map((c) => c.alpha);
      expect([...alphas].sort((a, b) => b - a)).toEqual(alphas);
      for (let i = 1; i < w.tail.length; i++) {
        const a = w.tail[i - 1];
        const b = w.tail[i];
        if (!a || !b) continue;
        expect(b.r).toBeLessThan(a.r);
        // Neighbouring lobes touch (one soft puff) but overlap less than half: no stepped column.
        const overlap = a.y + (a.ry ?? a.r) - (b.y - (b.ry ?? b.r));
        expect(overlap).toBeGreaterThan(0);
        expect(overlap).toBeLessThan(b.ry ?? b.r);
      }
    }
  });

  it('keeps the smears lighter than the light pink and the curl picture whole', () => {
    const luma = (c: number): number =>
      0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
    const n = cloud.nebula.colors;
    expect(luma(n.smear)).toBeGreaterThanOrEqual(luma(n.pinkLight));
    const size = curlPictureSize();
    const c = cloud.nebula.curls;
    expect(size.width).toBeGreaterThanOrEqual(c.r * 2 + c.width + 6);
    expect(size.height).toBeGreaterThanOrEqual(c.r * 1.6 + c.width + 6);
  });
});
