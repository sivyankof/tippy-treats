import type { MusicTrack } from '../../../data/music';

/** Bytes of one decoded sample (Web Audio keeps 32-bit floats). */
const BYTES_PER_SAMPLE = 4;
/** Channels of a decoded track (the files are stereo). */
export const TRACK_CHANNELS = 2;

type TrackLength = Pick<MusicTrack, 'frames' | 'sampleRate'>;

/** Frames of `track` once decoded at `rate` (`decodeAudioData` resamples to the context's rate). */
export function framesAt(track: TrackLength, rate: number): number {
  return Math.round((track.frames * rate) / track.sampleRate);
}

/** Memory of `track` decoded at `rate`, bytes. */
export function decodedBytes(track: TrackLength, rate: number, channels = TRACK_CHANNELS): number {
  return framesAt(track, rate) * channels * BYTES_PER_SAMPLE;
}

/** The loop of a decoded seamless track, in frames of the decoded buffer: [start, end). */
export interface LoopBounds {
  start: number;
  end: number;
}

/**
 * Where the loop lies in a decoded buffer of `decoded` frames. A decoder that keeps the AAC
 * encoder delay gives a buffer longer than the source by at least that delay: the loop starts
 * after it. A buffer shorter than the source (the encoder dropped a few samples at the end) loops
 * whole. Otherwise the loop is the source length from the start (padding at the end is skipped).
 */
export function loopBounds(
  decoded: number,
  track: TrackLength,
  rate: number,
  primingFrames: number,
): LoopBounds {
  const loop = framesAt(track, rate);
  const priming = framesAt({ frames: primingFrames, sampleRate: track.sampleRate }, rate);
  if (decoded >= loop + priming) return { start: priming, end: priming + loop };
  return { start: 0, end: Math.min(decoded, loop) };
}

/**
 * Smooths the seam of a loop in place: the last `frames` samples before `end` are bent, with a
 * smooth step, so that the sample after the last one (by its own slope) lands on the first sample
 * of the loop. A jump at the seam (in the source, or left by a few missing samples) becomes a
 * gentle slope of `frames` samples instead of a click. Samples elsewhere are not touched.
 */
export function smoothSeam(data: Float32Array, start: number, end: number, frames: number): void {
  const n = Math.min(frames, end - start - 2);
  if (n < 1) return;
  const last = data[end - 1] ?? 0;
  const prev = data[end - 2] ?? 0;
  const step = last + (last - prev) - (data[start] ?? 0);
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const index = end - n + i;
    data[index] = (data[index] ?? 0) - step * t * t * (3 - 2 * t);
  }
}

/**
 * The level at share `t` (0..1) of a fade from `from` to `to` along an equal-power curve: the
 * power moves by sin², so a track fading in and one fading out over the same time keep their sum
 * of powers, and the music does not dip in the middle of a change.
 */
export function equalPowerLevel(from: number, to: number, t: number): number {
  const s = Math.sin((Math.min(1, Math.max(0, t)) * Math.PI) / 2);
  const power = from * from + (to * to - from * from) * s * s;
  return Math.sqrt(Math.max(0, power));
}

/** The parts of an `AudioParam` a fade uses. */
type FadeParam = Pick<
  AudioParam,
  'value' | 'cancelScheduledValues' | 'setValueAtTime' | 'linearRampToValueAtTime'
>;

/**
 * Fades `param` from its value now to `to` over `sec` seconds of context time `now`, in `steps`
 * straight ramps along the equal-power curve. Whatever was scheduled is dropped and the value held
 * first, so a fade that interrupts another does not jump.
 */
export function fadeParam(
  param: FadeParam,
  now: number,
  to: number,
  sec: number,
  steps: number,
): void {
  const from = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  if (sec <= 0) {
    param.setValueAtTime(to, now);
    return;
  }
  for (let k = 1; k <= steps; k++) {
    param.linearRampToValueAtTime(equalPowerLevel(from, to, k / steps), now + (sec * k) / steps);
  }
}
