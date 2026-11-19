import { AUDIO_MIX } from '../../data/audio/audio-mix';

/** Level of a linear amplitude in dBFS; silence is -Infinity. */
export function toDb(amplitude: number): number {
  return amplitude <= 0 ? -Infinity : 20 * Math.log10(amplitude);
}

/** Amplitude of a level in dBFS. */
export function fromDb(db: number): number {
  return Math.pow(10, db / 20);
}

/** Highest absolute sample over all channels, dBFS. */
export function peakDb(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i] ?? 0));
  }
  return toDb(peak);
}

/**
 * RMS of the sounding part, dBFS: only the frames whose amplitude (the loudest channel) is above
 * `floorDb` (default -60 dBFS) count, so the silence around a short sound does not drag the figure
 * down. A buffer with no such frame reads -Infinity.
 */
export function rmsDb(
  channels: readonly Float32Array[],
  floorDb: number = AUDIO_MIX.levels.floorDb,
): number {
  const floor = fromDb(floorDb);
  const frames = channels.length === 0 ? 0 : Math.min(...channels.map((c) => c.length));
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < frames; i++) {
    let loud = 0;
    let energy = 0;
    for (const channel of channels) {
      const x = channel[i] ?? 0;
      loud = Math.max(loud, Math.abs(x));
      energy += x * x;
    }
    if (loud > floor) {
      sum += energy / channels.length;
      counted += 1;
    }
  }
  return counted === 0 ? -Infinity : toDb(Math.sqrt(sum / counted));
}

/** Samples at or beyond full scale (|x| >= 1): what would clip in a 16-bit file. */
export function clippedSamples(channels: readonly Float32Array[]): number {
  let n = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) if (Math.abs(channel[i] ?? 0) >= 1) n += 1;
  }
  return n;
}

/**
 * Seconds from the start to the last frame above `floorDb` (default -60 dBFS): how long the sound
 * is audible. 0 for silence.
 */
export function durationAboveFloor(
  channels: readonly Float32Array[],
  sampleRate: number,
  floorDb: number = AUDIO_MIX.levels.floorDb,
): number {
  const floor = fromDb(floorDb);
  let last = -1;
  for (const channel of channels) {
    for (let i = channel.length - 1; i > last; i--) {
      if (Math.abs(channel[i] ?? 0) > floor) {
        last = i;
        break;
      }
    }
  }
  return (last + 1) / sampleRate;
}
