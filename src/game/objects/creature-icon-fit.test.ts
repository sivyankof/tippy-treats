import { describe, expect, it } from 'vitest';
import { iconPlacement } from './creature-icon-fit';

describe('iconPlacement', () => {
  it('fits a wide picture by its width and centres it', () => {
    const p = iconPlacement(200, 50, 50, 100, 0);
    expect(p.scale).toBeCloseTo(0.5);
    expect(p).toMatchObject({ x: 50, y: 50 });
  });

  it('fits a tall picture by its height and puts the layer centre below the middle', () => {
    const p = iconPlacement(100, 150, 50, 100, 0);
    expect(p.scale).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(75);
  });

  it('keeps the margin', () => {
    const p = iconPlacement(100, 50, 50, 100, 0.1);
    expect(p.scale).toBeCloseTo(0.8);
  });
});
