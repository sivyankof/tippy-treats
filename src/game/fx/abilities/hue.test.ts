import { describe, expect, it } from 'vitest';
import { hueColor } from './hue';

describe('hueColor', () => {
  it('hits the primary colours of the wheel at full saturation', () => {
    expect(hueColor(0, 1)).toBe(0xff0000);
    expect(hueColor(1 / 3, 1)).toBe(0x00ff00);
    expect(hueColor(2 / 3, 1)).toBe(0x0000ff);
  });

  it('is white without saturation', () => {
    expect(hueColor(0.42, 0)).toBe(0xffffff);
  });

  it('wraps around the wheel in both directions', () => {
    expect(hueColor(1.25, 1)).toBe(hueColor(0.25, 1));
    expect(hueColor(-0.75, 1)).toBe(hueColor(0.25, 1));
  });
});
