import { deflateSync } from 'node:zlib';

/**
 * A small PNG writer for the store pictures: the browser canvas always writes RGBA, and both stores
 * refuse screenshots with an alpha channel, so the shots are written as 8-bit RGB (colour type 2).
 * The Google Play icon keeps its alpha (colour type 6).
 */

export type PngColor = 'rgb' | 'rgba';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_TYPE: Readonly<Record<PngColor, number>> = { rgb: 2, rgba: 6 };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head.subarray(0, 4), body, tail]);
}

/** Paeth predictor of the PNG filters. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** The value filter `type` predicts from the left (`a`), upper (`b`) and upper-left (`c`) bytes. */
function predict(type: number, a: number, b: number, c: number): number {
  switch (type) {
    case 1:
      return a;
    case 2:
      return b;
    case 3:
      return (a + b) >> 1;
    case 4:
      return paeth(a, b, c);
    default:
      return 0;
  }
}

/** One scanline filtered with each of the five filters; the one with the smallest sum of bytes (as signed) is kept. */
function filterRow(row: Uint8Array, prev: Uint8Array | null, bpp: number): Uint8Array {
  let best: Uint8Array | null = null;
  let bestScore = Infinity;
  for (let type = 0; type <= 4; type++) {
    const out = new Uint8Array(row.length + 1);
    out[0] = type;
    let score = 0;
    for (let i = 0; i < row.length; i++) {
      const x = row[i] ?? 0;
      const a = i >= bpp ? (row[i - bpp] ?? 0) : 0;
      const b = prev ? (prev[i] ?? 0) : 0;
      const c = prev && i >= bpp ? (prev[i - bpp] ?? 0) : 0;
      const value = (x - predict(type, a, b, c)) & 0xff;
      out[i + 1] = value;
      score += value < 128 ? value : 256 - value;
    }
    if (score < bestScore) {
      bestScore = score;
      best = out;
    }
  }
  return best ?? new Uint8Array(row.length + 1);
}

/**
 * Encodes RGBA pixels (`width * height * 4` bytes, as `getImageData` gives them). With `rgb` every
 * pixel must be opaque: a see-through pixel would silently turn into its colour on black.
 */
export function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
  color: PngColor,
): Buffer {
  if (rgba.length !== width * height * 4) throw new Error('encodePng: wrong pixel count');
  const bpp = color === 'rgb' ? 3 : 4;
  const rows: Uint8Array[] = [];
  let prev: Uint8Array | null = null;
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(width * bpp);
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      if (color === 'rgb' && rgba[from + 3] !== 255) {
        throw new Error(`encodePng: pixel ${x},${y} is not opaque`);
      }
      for (let k = 0; k < bpp; k++) row[x * bpp + k] = rgba[from + k] ?? 0;
    }
    rows.push(filterRow(row, prev, bpp));
    prev = row;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = COLOR_TYPE[color];
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  /** 2 is RGB, 6 is RGBA. */
  colorType: number;
}

/** The size and colour type of a PNG file, read from its header; null when it is not a PNG. */
export function readPngHeader(bytes: Uint8Array): PngHeader | null {
  const buf = Buffer.from(bytes);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24] ?? 0,
    colorType: buf[25] ?? 0,
  };
}
