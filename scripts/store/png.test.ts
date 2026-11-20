import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, encodePng, readPngHeader } from './png';

/** The chunks of a PNG file: type and data, the CRC checked. */
function chunks(png: Buffer): Array<{ type: string; data: Buffer }> {
  const out: Array<{ type: string; data: Buffer }> = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    expect(png.readUInt32BE(at + 8 + length)).toBe(crc32(png.subarray(at + 4, at + 8 + length)));
    out.push({ type, data });
    at += 12 + length;
  }
  return out;
}

/** Undoes the filters of the scanlines (the reader side of the PNG format). */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] ?? 0;
      const a = i >= bpp ? (out[y * stride + i - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + i] ?? 0) : 0;
      const c = y > 0 && i >= bpp ? (out[(y - 1) * stride + i - bpp] ?? 0) : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const predicted = [0, a, b, (a + b) >> 1, paeth][type ?? 0] ?? 0;
      out[y * stride + i] = (x + predicted) & 0xff;
    }
  }
  return out;
}

/** A small picture with gradients, so every filter has something to do. */
function picture(
  width: number,
  height: number,
  alpha: (x: number, y: number) => number,
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = (x * 37) & 0xff;
      rgba[i + 1] = (y * 53) & 0xff;
      rgba[i + 2] = (x * y) & 0xff;
      rgba[i + 3] = alpha(x, y);
    }
  }
  return rgba;
}

describe('encodePng', () => {
  it('writes opaque pixels as 8-bit RGB without alpha, and they read back the same', () => {
    const rgba = picture(7, 5, () => 255);
    const png = encodePng(7, 5, rgba, 'rgb');
    expect(readPngHeader(png)).toEqual({ width: 7, height: 5, bitDepth: 8, colorType: 2 });
    const parts = chunks(png);
    expect(parts.map((p) => p.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const pixels = unfilter(inflateSync(parts[1]!.data), 7, 5, 3);
    const expected = rgba.filter((_, i) => i % 4 !== 3);
    expect(Array.from(pixels)).toEqual(Array.from(expected));
  });

  it('keeps the alpha for rgba', () => {
    const rgba = picture(4, 3, (x) => x * 60);
    const png = encodePng(4, 3, rgba, 'rgba');
    expect(readPngHeader(png)?.colorType).toBe(6);
    const pixels = unfilter(inflateSync(chunks(png)[1]!.data), 4, 3, 4);
    expect(Array.from(pixels)).toEqual(Array.from(rgba));
  });

  it('refuses a see-through pixel in an RGB picture and a wrong pixel count', () => {
    expect(() =>
      encodePng(
        2,
        2,
        picture(2, 2, (x, y) => (x + y === 2 ? 254 : 255)),
        'rgb',
      ),
    ).toThrow(/not opaque/);
    expect(() => encodePng(3, 3, new Uint8Array(8), 'rgb')).toThrow(/pixel count/);
  });
});

describe('readPngHeader', () => {
  it('is null for anything that is not a PNG', () => {
    expect(readPngHeader(Buffer.from('not a png at all, just some text here'))).toBeNull();
  });
});
