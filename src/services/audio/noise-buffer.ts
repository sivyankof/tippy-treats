/** A mono buffer of white noise `seconds` long, filled from `random` (0..1). */
export function noiseBuffer(
  ctx: BaseAudioContext,
  seconds: number,
  random: () => number,
): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
  return buffer;
}
