/**
 * Samples of the tape and vinyl bed of the music (docs/06, section 7, "Музыка"): pure, filled
 * once per player into buffers. No Web Audio here.
 */

/** Smoothing factor of a one-pole lowpass at `cutoff` Hz. */
function onePole(cutoff: number, sampleRate: number): number {
  return 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
}

/**
 * A loopable tape hiss, `frames` long: white noise through a gentle pink tilt and a one-pole
 * lowpass at `cutoff`, the mean taken out (no DC), scaled to peak 1, and the last `fadeFrames`
 * cross-faded into the start so the loop point has no step.
 */
export function tapeHiss(
  frames: number,
  sampleRate: number,
  random: () => number,
  cutoff: number,
  fadeFrames: number,
): Float32Array<ArrayBuffer> {
  const total = frames + fadeFrames;
  const raw = new Float32Array(total);
  const a = onePole(cutoff, sampleRate);
  // Paul Kellet's economy pink filter, then the lowpass.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let lp = 0;
  for (let i = 0; i < total; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = b0 + b1 + b2 + white * 0.1848;
    lp += a * (pink - lp);
    raw[i] = lp;
  }
  const out = new Float32Array(new ArrayBuffer(frames * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < frames; i++) out[i] = raw[i] ?? 0;
  // The tail past the end fades into the head: the loop reads on smoothly.
  for (let i = 0; i < fadeFrames && i < frames; i++) {
    const w = (i + 0.5) / fadeFrames;
    out[i] = (raw[i] ?? 0) * w + (raw[frames + i] ?? 0) * (1 - w);
  }
  let mean = 0;
  for (let i = 0; i < frames; i++) mean += out[i] ?? 0;
  mean /= Math.max(1, frames);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const v = (out[i] ?? 0) - mean;
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  if (peak > 0) for (let i = 0; i < frames; i++) out[i] = (out[i] ?? 0) / peak;
  return out;
}

/**
 * One vinyl crackle, `frames` long: a burst of noise under a fast exponential fade, differenced
 * (a highpass: a click, not a thump, and no DC), scaled to peak 1, ending at zero.
 */
export function crackle(frames: number, random: () => number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(new ArrayBuffer(frames * Float32Array.BYTES_PER_ELEMENT));
  let prev = 0;
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const env = Math.exp((-6 * i) / Math.max(1, frames)) * (1 - i / frames);
    const x = (random() * 2 - 1) * env;
    out[i] = x - prev;
    prev = x;
    peak = Math.max(peak, Math.abs(out[i] ?? 0));
  }
  if (frames > 0) out[frames - 1] = 0;
  if (peak > 0) for (let i = 0; i < frames; i++) out[i] = (out[i] ?? 0) / peak;
  return out;
}
