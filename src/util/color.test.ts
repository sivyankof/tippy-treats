import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  cssColor,
  dimPixels,
  fromHsl,
  luminance,
  mixColor,
  multiplyColor,
  parseHex,
  shade,
  toHsl,
} from './color';

describe('color helpers', () => {
  it('mixes endpoints and the middle', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xfefefe, 0.5)).toBe(0x7f7f7f);
  });

  it('multiplies colours channel by channel', () => {
    expect(multiplyColor(0xffffff, 0x6a62a0)).toBe(0x6a62a0);
    expect(multiplyColor(0x000000, 0xffffff)).toBe(0x000000);
    expect(multiplyColor(0x808080, 0xff0000)).toBe(0x800000);
  });

  it('formats CSS colour strings with padding', () => {
    expect(cssColor(0xff5c8a)).toBe('#ff5c8a');
    expect(cssColor(0x00000a)).toBe('#00000a');
    expect(cssColor(0)).toBe('#000000');
  });

  it('shades towards black and white', () => {
    expect(shade(0x808080, -1)).toBe(0x000000);
    expect(shade(0x808080, 1)).toBe(0xffffff);
    expect(shade(0x808080, 0)).toBe(0x808080);
  });

  it('measures luminance and contrast like WCAG', () => {
    expect(luminance(0x000000)).toBe(0);
    expect(luminance(0xffffff)).toBeCloseTo(1, 6);
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 4);
    expect(contrastRatio(0x777777, 0x777777)).toBe(1);
    expect(contrastRatio(0xffffff, 0x000000)).toBe(contrastRatio(0x000000, 0xffffff));
  });

  it('reads #rrggbb strings and round-trips with cssColor', () => {
    expect(parseHex('#ff5c8a')).toBe(0xff5c8a);
    expect(parseHex('#00000a')).toBe(0x00000a);
    expect(cssColor(parseHex('#3b2a4a'))).toBe('#3b2a4a');
  });
});

describe('hsl conversion', () => {
  it('round-trips colours', () => {
    for (const color of [0xe8b04a, 0x34b09a, 0x7662b8, 0x808080, 0x000000, 0xffffff]) {
      const back = fromHsl(toHsl(color));
      for (const shift of [16, 8, 0]) {
        expect(Math.abs(((back >> shift) & 0xff) - ((color >> shift) & 0xff))).toBeLessThanOrEqual(
          1,
        );
      }
    }
  });

  it('reads the hue of a primary', () => {
    expect(toHsl(0xff0000).h).toBeCloseTo(0, 6);
    expect(toHsl(0x00ff00).h).toBeCloseTo(1 / 3, 6);
    expect(toHsl(0x0000ff).h).toBeCloseTo(2 / 3, 6);
  });
});

describe('dimPixels', () => {
  it('pulls colours toward their grey and darkens them, leaving alpha and greys in tone', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 200, 128, 128, 128, 255, 0, 0, 0, 0]);
    dimPixels(data, 0.5, 0.5);
    const grey = 0.299 * 255;
    expect(data[0]).toBe(Math.round((grey + (255 - grey) * 0.5) * 0.5));
    expect(data[1]).toBe(Math.round(grey * 0.5 * 0.5));
    expect(data[3]).toBe(200);
    // A grey only darkens.
    expect([data[4], data[5], data[6]]).toEqual([64, 64, 64]);
    expect(data[11]).toBe(0);
  });

  it('leaves the pixels as they are at full saturation and brightness', () => {
    const data = new Uint8ClampedArray([10, 200, 90, 255]);
    dimPixels(data, 1, 1);
    expect([...data]).toEqual([10, 200, 90, 255]);
  });
});
