import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

function text(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

describe('encodeWav', () => {
  it('writes a 16-bit PCM header for two channels', () => {
    const left = new Float32Array([0, 0.5, -0.5]);
    const right = new Float32Array([1, -1, 0]);
    const bytes = encodeWav([left, right], 44_100);
    const view = new DataView(bytes.buffer);
    expect(text(bytes, 0, 4)).toBe('RIFF');
    expect(text(bytes, 8, 12)).toBe('WAVE');
    expect(text(bytes, 36, 40)).toBe('data');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(3 * 2 * 2);
    expect(bytes.length).toBe(44 + 12);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  });

  it('interleaves the channels and scales to the integer range', () => {
    const bytes = encodeWav([new Float32Array([0.5, -1]), new Float32Array([1, 0])], 8000);
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(16384);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(0);
  });

  it('clamps samples outside -1..1', () => {
    const view = new DataView(encodeWav([new Float32Array([3, -3])], 8000).buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });

  it('handles no channels', () => {
    expect(encodeWav([], 8000).length).toBe(44);
  });
});
