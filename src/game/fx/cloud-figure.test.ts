import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { RULE_ANIM } from '../../data/rule-anim';
import {
  bodyDisplaySize,
  cloudSilhouette,
  nebulaSilhouette,
  requiredBodyWidth,
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

  it('has one smooth wave for the nebula underside: it only deepens to the middle and shallows after it', () => {
    const s = nebulaSilhouette();
    const bottomAt = (x: number): number => {
      let bottom = x >= s.body.left && x <= s.body.right ? s.body.bottom : -Infinity;
      for (const c of s.lobes) {
        const dx = Math.abs(x - c.x);
        if (dx < c.r) bottom = Math.max(bottom, c.y + Math.sqrt(c.r * c.r - dx * dx));
      }
      return bottom;
    };
    const centre = RULE_ANIM.cloud.nebula.belly.centre;
    let worstDip = 0;
    for (let x = 160; x < 880; x += 4) {
      const next = x + 4;
      // Moving away from the middle the edge may only rise (less the scallops of a close row of circles).
      const outward = x < centre ? bottomAt(x) - bottomAt(next) : bottomAt(next) - bottomAt(x);
      worstDip = Math.max(worstDip, outward < 0 ? -outward : 0);
    }
    expect(worstDip).toBeLessThanOrEqual(3);
  });
});
