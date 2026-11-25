import { describe, expect, it } from 'vitest';
import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';
import { buildHand } from './hand-shape';

const look = TUTORIAL_ANIM.hand;
/** The old hand was 150 x 200: the new one must not be taller. */
const OLD_HAND_HEIGHT = 200;

const extent = (points: readonly { x: number; y: number }[][]) => {
  const flat = points.flat();
  return {
    minX: Math.min(...flat.map((p) => p.x)),
    minY: Math.min(...flat.map((p) => p.y)),
    maxX: Math.max(...flat.map((p) => p.x)),
    maxY: Math.max(...flat.map((p) => p.y)),
  };
};

describe('buildHand', () => {
  const hand = buildHand(look);

  it('starts at the origin and is no taller than the old hand', () => {
    const box = extent(hand.silhouette(0));
    expect(box.minX).toBeCloseTo(0);
    expect(box.minY).toBeCloseTo(0);
    expect(box.maxX).toBeCloseTo(hand.width);
    expect(box.maxY).toBeCloseTo(hand.height);
    expect(hand.height).toBeLessThanOrEqual(OLD_HAND_HEIGHT);
  });

  it('has the touch point on the top of the picture, on the finger', () => {
    expect(hand.tip.y).toBeCloseTo(0);
    expect(hand.tip.x).toBeGreaterThan(0);
    expect(hand.tip.x).toBeLessThan(hand.width);
  });

  it('pushes the outline outwards by the grow', () => {
    const plain = extent(hand.silhouette(0));
    const grown = extent(hand.silhouette(10));
    expect(plain.minY - grown.minY).toBeCloseTo(10, 0);
    expect(grown.maxX - plain.maxX).toBeCloseTo(10, 0);
  });

  it('keeps the lit palm and cuff inside their bodies', () => {
    const palm = extent([hand.palm]);
    const lit = extent([hand.palmLit]);
    expect(lit.maxX).toBeLessThan(palm.maxX);
    expect(lit.maxY).toBeLessThan(palm.maxY);
    const cuff = extent([hand.cuff]);
    expect(extent([hand.cuffLit]).maxY).toBeLessThan(cuff.maxY);
  });

  it('leans to the left with a negative tilt', () => {
    const straight = buildHand({ ...look, tiltDeg: 0 });
    const tilted = buildHand({ ...look, tiltDeg: -10 });
    // The fingertip sits further left of the cuff centre when the hand leans left.
    const cuffMid = (h: typeof hand) =>
      extent([h.cuff]).minX + (extent([h.cuff]).maxX - extent([h.cuff]).minX) / 2;
    expect(tilted.tip.x - cuffMid(tilted)).toBeLessThan(straight.tip.x - cuffMid(straight));
  });
});
