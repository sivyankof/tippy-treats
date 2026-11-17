import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { RULE_ANIM } from '../../data/rule-anim';
import {
  bodyDisplaySize,
  cloudSilhouette,
  nebulaSilhouette,
  requiredBodyWidth,
  silhouetteBottomAt,
  silhouetteBounds,
  silhouetteTopAt,
} from './cloud-figure';

const figure = RULE_ANIM.cloud.figure;

describe('cloud figures', () => {
  it('has a body wide enough to hide a layer anywhere on the screen during the longest cover', () => {
    expect(bodyDisplaySize().width).toBeGreaterThanOrEqual(requiredBodyWidth());
  });

  it('has a body taller than the layer with room for the bob and the shake', () => {
    const margin = RULE_ANIM.cloud.figure.layerMargin;
    const need = BALANCE.layer.height + 2 * (margin + RULE_ANIM.cloud.bobPx);
    expect(bodyDisplaySize().height).toBeGreaterThanOrEqual(need);
  });

  it('fits the shared atlas picture size and keeps its outline inside the picture', () => {
    expect(figure.width).toBeLessThanOrEqual(1024);
    expect(figure.height).toBeLessThanOrEqual(1024);
    for (const s of [cloudSilhouette(), nebulaSilhouette()]) {
      const b = silhouetteBounds(s);
      expect(b.left - figure.outline).toBeGreaterThanOrEqual(0);
      expect(b.top - figure.outline).toBeGreaterThanOrEqual(0);
      expect(b.right + figure.outline).toBeLessThanOrEqual(figure.width);
      expect(b.bottom + figure.outline).toBeLessThanOrEqual(figure.height);
    }
  });

  it('is a lump, not a ribbon: the top line rises well above the thin ends and the bumps differ in size', () => {
    const nebula = nebulaSilhouette();
    for (const s of [cloudSilhouette(), nebula]) {
      const ends = Math.min(silhouetteTopAt(s, 150), silhouetteTopAt(s, 850));
      const hump = Math.min(...[480, 520, 560, 600, 640].map((x) => silhouetteTopAt(s, x)));
      expect(ends - hump).toBeGreaterThan(s === nebula ? 30 : 60);
      const radii = s.circles.map((c) => c.r);
      expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(2.5);
    }
  });

  it('keeps the whole cover row inside the body wherever the layer is on the screen', () => {
    const b = figure.body;
    const rowHalf = BALANCE.layer.height / 2 + RULE_ANIM.cloud.bobPx + figure.layerMargin;
    const mid = (b.top + b.bottom) / 2;
    expect(((b.bottom - b.top) / 2) * figure.scale).toBeGreaterThanOrEqual(rowHalf);
    expect(Math.abs(b.top + b.bottom - 2 * (figure.height / 2))).toBeLessThanOrEqual(1);
    expect(mid).toBe(figure.height / 2);
  });

  it('keeps the nebula top low above the body: the HUD plates over the row stay clear (390x693)', () => {
    const top = silhouetteBounds(nebulaSilhouette()).top - figure.outline;
    // Baked px the figure may reach above the body top; the cloud has its tall hump, the nebula does not.
    expect(figure.body.top - top).toBeLessThanOrEqual(RULE_ANIM.cloud.nebula.maxRiseAboveBody);
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

  it('has 3 or 4 short wisps of different length that fade out and keep inside the picture', () => {
    const s = nebulaSilhouette();
    const wisps = s.wisps ?? [];
    expect(wisps.length).toBeGreaterThanOrEqual(3);
    expect(wisps.length).toBeLessThanOrEqual(4);
    const lens = wisps.map((w) => (w.tail[w.tail.length - 1]?.y ?? 0) - figure.body.bottom);
    expect(new Set(lens).size).toBe(wisps.length);
    expect(Math.max(...lens)).toBeLessThanOrEqual(70);
    for (const w of wisps) {
      const alphas = w.tail.map((c) => c.alpha);
      expect([...alphas].sort((a, b) => b - a)).toEqual(alphas);
      expect(alphas[alphas.length - 1]).toBeLessThan(0.2);
    }
    expect(silhouetteBounds(s).bottom + figure.outline).toBeLessThanOrEqual(figure.height - 3);
  });

  it('keeps the full-width covered band of the body rows as it was', () => {
    const s = nebulaSilhouette();
    // Every column of the screen-wide part is covered from the body top to the body bottom.
    for (let x = figure.body.left + 70; x <= figure.body.right - 70; x += 8) {
      expect(silhouetteTopAt(s, x)).toBeLessThanOrEqual(figure.body.top);
      expect(silhouetteBottomAt(s, x)).toBeGreaterThanOrEqual(figure.body.bottom);
    }
  });
});
