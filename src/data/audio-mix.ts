/**
 * Mixing of the audio output (docs/06-art-animation-audio.md, section 7, "Микширование").
 * Chain: sfx bus -> sfx compressor -> master; music bus -> master; master -> limiter -> output.
 * Gains are linear, times are seconds, thresholds are dB.
 */
export const AUDIO_MIX = {
  /** Level of the sfx bus: the old synth master gain, so every existing sound keeps its loudness. */
  sfxLevel: 0.7,
  /** Level of the music bus: the bed sits well under the effects so a drop or a bell always cuts through. */
  musicLevel: 0.5,
  /** Level of the master gain: unity, the buses carry the balance. */
  masterLevel: 1,
  /** The gentle compressor of the sfx bus (the one the synth always had). */
  sfxCompressor: { threshold: -18, knee: 20, ratio: 4, attack: 0.003, release: 0.2 },
  /**
   * Output limiter: a static soft clipper (a `WaveShaperNode`), not a compressor. Below `threshold`
   * (linear) the signal is not touched at all; above it the curve bends smoothly towards `ceiling`
   * (below full scale), so stacked sounds never clip. A `DynamicsCompressorNode` was tried and
   * dropped: in Chrome it is not transparent below its threshold (rendered offline it made the drop
   * 6.5 dB quieter and the guest splat 4 dB, while loud sounds stayed put), and existing sounds
   * must sound exactly as before. `curveSize` points over -1..1 (odd, so zero is a point).
   */
  limiter: { threshold: 0.7, ceiling: 0.98, curveSize: 4097 },
  /** Time constant of the short ramp of a bus switch: about 30 ms to settle, no click. */
  switchRampSec: 0.01,
  /** Time constant of the music duck ramp: settles in about 0.3 s both ways. */
  duckRampSec: 0.1,
  /** Share of the music level taken away while a duck reason holds (the "40%" of the docs). */
  duckShare: 0.4,
  /** Length of the silent unlock buffer: it only has to be a source that was played inside the gesture. */
  unlockBufferSamples: 1,

  /** The same sound id is not started again within this time. */
  dedupeSec: 0.04,
  /** Own minimum intervals of sounds that come in fast series (they replace the general dedupe). */
  dedupeById: { collapseThud: 0.045 } as Readonly<Record<string, number>>,
  /**
   * Sounds in flight. Counted as sounds, not nodes: each sound is 2 to 8 nodes. Mobile Safari
   * copes with a few hundred live nodes; the busiest real moment is a drop, a perfect bell, a coin,
   * an ability, three or four collapse slaps and the music (about 6 voices): 8 to 10 sounds and
   * roughly 100 nodes. So `normal` sounds stop at 8 in flight, `ambient` (weather, yawns) yield
   * early at 4, and `critical` ones are never refused.
   */
  voiceCap: { normal: 8, ambient: 4 },

  /** Offline render: sample rate, longest render, silence after the last sound. */
  offline: { sampleRate: 44_100, maxSeconds: 8, tailSec: 0.25, channels: 2, noiseSeed: 20_261_118 },
  /** Levels: frames quieter than this (dBFS) do not count as sound in the RMS reading. */
  levels: { floorDb: -60 },
} as const;
