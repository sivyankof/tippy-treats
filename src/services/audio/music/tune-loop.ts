import { MUSIC, MUSIC_TRACKS, type MusicTrack, type MusicTrackId } from '../../../data/audio/music';

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

/** Memory of a decoded buffer, bytes. */
export function bufferBytes(buffer: Pick<AudioBuffer, 'length' | 'numberOfChannels'>): number {
  return buffer.length * buffer.numberOfChannels * BYTES_PER_SAMPLE;
}

/** Length of a track's source (one loop of a seamless one), seconds. */
export function trackLoopSec(track: TrackLength): number {
  return track.frames / track.sampleRate;
}

/** A decoded seamless track ready to loop. */
export interface Decoded {
  buffer: AudioBuffer;
  bounds: LoopBounds;
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

/** How the seam is smoothed: the straight line fitted to the last `fit` samples and the half-width of the averaging. */
export interface SeamSmoothing {
  fit: number;
  radius: number;
}

/**
 * Smooths the seam of a loop in place. The last `frames` samples before `end` are bent, with a
 * smooth step, so that the line fitted to the loop's last `fit` samples (a fit, not the last two
 * samples: AAC leaves a little codec noise in the final samples of a file) lands on the first
 * sample of the loop; along the same step they are averaged over `radius` samples each side, so
 * the codec noise right at the end fades too. A jump at the seam (in the source, or left by a few
 * missing samples) becomes a gentle slope instead of a click. Samples elsewhere are not touched.
 */
export function smoothSeam(
  data: Float32Array,
  start: number,
  end: number,
  frames: number,
  { fit, radius }: SeamSmoothing,
): void {
  const n = Math.min(frames, end - start - fit);
  if (n < 1 || fit < 2) return;
  // Least squares line through the last `fit` samples, taken one sample past the end.
  const mid = (fit - 1) / 2;
  let mean = 0;
  for (let k = 0; k < fit; k++) mean += data[end - fit + k] ?? 0;
  mean /= fit;
  let num = 0;
  let den = 0;
  for (let k = 0; k < fit; k++) {
    num += (k - mid) * ((data[end - fit + k] ?? 0) - mean);
    den += (k - mid) * (k - mid);
  }
  const next = mean + (num / den) * (fit - mid);
  const step = next - (data[start] ?? 0);
  const ease = (i: number): number => {
    const t = (i + 1) / n;
    return t * t * (3 - 2 * t);
  };
  // The tail bent onto the head first, then laid out as the loop plays it: the untouched samples
  // before it, the bent tail, the head after the wrap.
  const before = Math.min(radius, end - n - start);
  const around = new Float32Array(before + n + radius);
  around.set(data.subarray(end - n - before, end), 0);
  for (let i = 0; i < n; i++) around[before + i] = (around[before + i] ?? 0) - step * ease(i);
  around.set(data.subarray(start, start + radius), before + n);
  for (let i = 0; i < n; i++) {
    const at = before + i;
    const lo = Math.max(0, at - radius);
    const hi = Math.min(around.length - 1, at + radius);
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += around[k] ?? 0;
    const own = around[at] ?? 0;
    data[end - n + i] = own + ease(i) * (sum / (hi - lo + 1) - own);
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
 * Fades `param` to `to` over `sec` seconds, in `steps` straight ramps along the equal-power curve,
 * from context time `startAt` (now or later; the value until then is held). Whatever was scheduled
 * from `now` on is dropped and the value now held first, so a fade that interrupts another does not
 * jump.
 */
export function fadeParam(
  param: FadeParam,
  now: number,
  to: number,
  sec: number,
  steps: number,
  startAt = now,
): void {
  const from = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  const begin = Math.max(now, startAt);
  if (begin > now) param.setValueAtTime(from, begin);
  if (sec <= 0) {
    param.setValueAtTime(to, begin);
    return;
  }
  for (let k = 1; k <= steps; k++) {
    param.linearRampToValueAtTime(equalPowerLevel(from, to, k / steps), begin + (sec * k) / steps);
  }
}

/**
 * Makes a decoded seamless track ready to loop: finds its loop bounds and smooths the seam of
 * every channel in place (once, as it comes out of the decoder). The live player and the seam
 * measurement both go through here.
 */
export function prepareLoop(buffer: AudioBuffer, track: MusicTrackId): LoopBounds {
  const rate = buffer.sampleRate;
  const bounds = loopBounds(buffer.length, MUSIC_TRACKS[track], rate, MUSIC.aacPrimingFrames);
  const frames = Math.round(MUSIC.seamSmoothSec * rate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    smoothSeam(buffer.getChannelData(c), bounds.start, bounds.end, frames, MUSIC.seam);
  }
  return bounds;
}
