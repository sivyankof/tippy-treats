/** Size of the RIFF/WAVE header of a 16-bit PCM file, bytes. */
const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;
const PCM_FORMAT = 1;
const BITS = 16;
const INT16_MAX = 0x7fff;
const INT16_MIN = -0x8000;

function writeText(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Encodes channels of float samples (-1..1, clamped) as a 16-bit PCM WAV file. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const count = channels.length;
  const frames = count === 0 ? 0 : Math.min(...channels.map((c) => c.length));
  const dataBytes = frames * count * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  writeText(view, 0, 'RIFF');
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true);
  writeText(view, 8, 'WAVE');
  writeText(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * BYTES_PER_SAMPLE, true);
  view.setUint16(32, count * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BITS, true);
  writeText(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = HEADER_BYTES;
  for (let i = 0; i < frames; i++) {
    for (const channel of channels) {
      const x = Math.max(-1, Math.min(1, channel[i] ?? 0));
      const value = x < 0 ? x * -INT16_MIN : x * INT16_MAX;
      view.setInt16(offset, Math.round(value), true);
      offset += BYTES_PER_SAMPLE;
    }
  }
  return bytes;
}
