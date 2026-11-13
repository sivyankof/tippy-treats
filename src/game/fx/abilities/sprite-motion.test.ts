import { describe, expect, it } from 'vitest';
import { makeSpec, sampleSprite, shapeAt, type SpriteFrame } from './sprite-motion';

const frame = (): SpriteFrame => ({ x: 0, y: 0, scaleX: 0, scaleY: 0, angle: 0, alpha: 0 });

describe('shapeAt', () => {
  it('linear follows the progress and clamps it', () => {
    expect(shapeAt('linear', 0.25)).toBe(0.25);
    expect(shapeAt('linear', -1)).toBe(0);
    expect(shapeAt('linear', 2)).toBe(1);
  });

  it('bump is 0 at both ends and 1 in the middle', () => {
    expect(shapeAt('bump', 0)).toBeCloseTo(0);
    expect(shapeAt('bump', 0.5)).toBeCloseTo(1);
    expect(shapeAt('bump', 1)).toBeCloseTo(0);
  });

  it('snap stretches to full and falls back to 0 faster than it rose', () => {
    expect(shapeAt('snap', 0)).toBe(0);
    expect(shapeAt('snap', 0.6)).toBeCloseTo(1);
    expect(shapeAt('snap', 1)).toBe(0);
    expect(shapeAt('snap', 0.9)).toBeLessThan(shapeAt('snap', 0.3));
  });
});

describe('makeSpec', () => {
  it('keeps a sprite still, opaque and uniformly scaled by default', () => {
    const spec = makeSpec({ texture: 't', x0: 10, y0: 20, lifeMs: 100 });
    expect(spec).toMatchObject({ x1: 10, y1: 20, scaleX0: 1, scaleX1: 1, scaleY0: 1, scaleY1: 1 });
    expect(spec).toMatchObject({ alpha0: 1, alpha1: 1, delayMs: 0, screen: false });
  });

  it('lets the scale of the y axis follow the x axis until told otherwise', () => {
    const spec = makeSpec({ texture: 't', x0: 0, y0: 0, lifeMs: 1, scaleX0: 2, scaleX1: 3 });
    expect(spec).toMatchObject({ scaleY0: 2, scaleY1: 3 });
    const tall = makeSpec({ texture: 't', x0: 0, y0: 0, lifeMs: 1, scaleX0: 2, scaleY1: 5 });
    expect(tall).toMatchObject({ scaleX1: 2, scaleY0: 2, scaleY1: 5 });
  });
});

describe('sampleSprite', () => {
  const spec = makeSpec({
    texture: 't',
    x0: 0,
    y0: 100,
    x1: 100,
    y1: 0,
    arc: 40,
    scaleX0: 1,
    scaleX1: 0,
    alpha0: 1,
    alpha1: 0,
    angle1: 90,
    lifeMs: 100,
  });

  it('starts at the start pose', () => {
    expect(sampleSprite(spec, 0, frame())).toEqual({
      x: 0,
      y: 100,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      alpha: 1,
    });
  });

  it('ends at the end pose', () => {
    const end = sampleSprite(spec, 1, frame());
    expect(end.x).toBe(100);
    expect(end.y).toBeCloseTo(0);
    expect(end.scaleX).toBe(0);
    expect(end.alpha).toBe(0);
    expect(end.angle).toBe(90);
  });

  it('bulges the path up by the arc in the middle', () => {
    expect(sampleSprite(spec, 0.5, frame()).y).toBeCloseTo(50 - 40);
  });

  it('applies the easing to the path only', () => {
    const eased = makeSpec({ texture: 't', x0: 0, y0: 0, x1: 100, lifeMs: 1, move: (t) => t * t });
    expect(sampleSprite(eased, 0.5, frame()).x).toBeCloseTo(25);
  });

  it('can strand: the scale snaps back while the alpha holds', () => {
    const strand = makeSpec({
      texture: 't',
      x0: 0,
      y0: 0,
      scaleY0: 0,
      scaleY1: 4,
      scaleShape: 'snap',
      lifeMs: 1,
    });
    expect(sampleSprite(strand, 0.6, frame()).scaleY).toBeCloseTo(4);
    expect(sampleSprite(strand, 1, frame()).scaleY).toBe(0);
  });
});
