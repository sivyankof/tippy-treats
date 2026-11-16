import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/balance';
import { RULE_ANIM } from '../../data/rule-anim';
import {
  bodyDisplaySize,
  cloudSilhouette,
  nebulaSilhouette,
  requiredBodyWidth,
  silhouetteBounds,
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

  it('makes the nebula lumpier than the cloud', () => {
    const c = silhouetteBounds(cloudSilhouette());
    const n = silhouetteBounds(nebulaSilhouette());
    expect(n.bottom - n.top).toBeGreaterThan(c.bottom - c.top);
  });
});
