/**
 * Instruments of the music (docs/06-art-animation-audio.md, section 7, "Музыка"). Every tune
 * plays only these recipes; `services/audio/music/music-voices.ts` builds one voice per note.
 * Times are seconds, frequencies Hz, gains linear. Envelopes are click-free: a linear attack
 * from silence, exponential falls, the voice stops about 48 dB down.
 */

/** One oscillator of an electric-piano note. */
export interface KeysPartial {
  wave: 'sine' | 'triangle';
  /** Offset from the note in cents (the two oscillators sit a few cents apart: a slow beating). */
  detuneCents: number;
  gain: number;
}

/**
 * Electric piano: two oscillators (sine and triangle, a few cents apart) into one envelope that
 * only fades (no sustain). The soft top comes from the shared keys filter of the music chain, the
 * tape wobble from its shared slow LFO on the oscillators' detune.
 */
export interface KeysInstrument {
  kind: 'keys';
  partials: readonly KeysPartial[];
  attack: number;
  /** Time constant of the fade from the peak. */
  decay: number;
  /** Time constant of the fade after the key is let go (the note's end). */
  release: number;
}

/** A tone from its own harmonic table (a periodic wave built once per player). */
export interface ToneInstrument {
  kind: 'tone';
  /** Amplitudes of the harmonics, the fundamental first. */
  harmonics: readonly number[];
  attack: number;
  /** Time constant of the fall from the peak to the sustain level. */
  decay: number;
  /** Sustain level, share of the peak. */
  sustain: number;
  /** Time constant of the fade after the note's end. */
  release: number;
}

/** A soft kick: a sine that slides down in pitch and dies fast. */
export interface DrumInstrument {
  kind: 'drum';
  startFreq: number;
  endFreq: number;
  /** Time of the pitch slide. */
  sweep: number;
  attack: number;
  decay: number;
}

/** A short burst of filtered noise (snare, hat). */
export interface NoiseInstrument {
  kind: 'noise';
  filter: BiquadFilterType;
  cutoff: number;
  q: number;
  attack: number;
  decay: number;
  /** Playback-rate spread +- of each hit, so a row of hits does not sound like one sample. */
  spread: number;
}

export type Instrument = KeysInstrument | ToneInstrument | DrumInstrument | NoiseInstrument;

export const INSTRUMENTS = {
  /**
   * The electric piano: sine and a quieter triangle 6 cents apart, 14 ms attack, a fade of about
   * 2 s (-20 dB at 1.5 s, -40 dB at 3 s), soft release.
   */
  ep: {
    kind: 'keys',
    partials: [
      { wave: 'sine', detuneCents: -3, gain: 1 },
      { wave: 'triangle', detuneCents: 3, gain: 0.32 },
    ],
    attack: 0.014,
    decay: 0.65,
    release: 0.35,
  },
  /** A slow-swelling electric piano for the long second chord line (no hammer). */
  epSwell: {
    kind: 'keys',
    partials: [
      { wave: 'sine', detuneCents: -4, gain: 1 },
      { wave: 'triangle', detuneCents: 4, gain: 0.22 },
    ],
    attack: 0.35,
    decay: 1.6,
    release: 0.6,
  },
  /** Soft sine lead (the evening tune): a faint second harmonic, slow attack, gentle sustain. */
  softSine: {
    kind: 'tone',
    harmonics: [1, 0.05, 0.015],
    attack: 0.035,
    decay: 0.7,
    sustain: 0.35,
    release: 0.4,
  },
  /**
   * Warm bass: a sine with a little triangle (odd harmonics at 1/n^2) and a touch of the octave,
   * so a phone speaker still hints at its pitch.
   */
  bass: {
    kind: 'tone',
    harmonics: [1, 0.12, 0.1, 0, 0.035, 0, 0.015],
    attack: 0.03,
    decay: 0.9,
    sustain: 0.55,
    release: 0.22,
  },
  /** Soft kick: a sine falling 90 -> 45 Hz, a 6 ms attack (no click). */
  kick: { kind: 'drum', startFreq: 90, endFreq: 45, sweep: 0.11, attack: 0.006, decay: 0.13 },
  /** Muted snare: a short band of noise around 1.6 kHz. */
  snare: {
    kind: 'noise',
    filter: 'bandpass',
    cutoff: 1600,
    q: 0.8,
    attack: 0.003,
    decay: 0.055,
    spread: 0.06,
  },
  /** Very quiet hat: highpassed noise, short. */
  hat: {
    kind: 'noise',
    filter: 'highpass',
    cutoff: 5200,
    q: 0.6,
    attack: 0.002,
    decay: 0.022,
    spread: 0.08,
  },
} as const satisfies Record<string, Instrument>;

export type InstrumentId = keyof typeof INSTRUMENTS;

/** Numbers of the voices: the note math and when a voice is let go. */
export const MUSIC_VOICE = {
  /** Frequency of pitch 0 (C4). */
  c4Hz: 261.63,
  /** A voice stops this many time constants into its last fade (about -48 dB): inaudible, no click. */
  stopTaus: 5.5,
  /**
   * The electric piano stops a little earlier (about -39 dB under the note's peak, far under the
   * tape hiss): its notes ring for seconds, and each holds three nodes until it stops.
   */
  keysStopTaus: 4.5,
  /** Length of the shared noise buffer of a player. */
  noiseSeconds: 1,
} as const;
