import { describe, expect, it } from 'vitest';
import { cssColor, mixColor, parseHex, shade } from './color';

describe('color helpers', () => {
  it('mixes endpoints and the middle', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xfefefe, 0.5)).toBe(0x7f7f7f);
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

  it('reads #rrggbb strings and round-trips with cssColor', () => {
    expect(parseHex('#ff5c8a')).toBe(0xff5c8a);
    expect(parseHex('#00000a')).toBe(0x00000a);
    expect(cssColor(parseHex('#3b2a4a'))).toBe('#3b2a4a');
  });
});
