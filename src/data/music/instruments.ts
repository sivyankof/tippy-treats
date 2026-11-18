/**
 * Instruments of the music (docs/06-art-animation-audio.md, section 7, "Музыка"). Every tune
 * plays only these recipes; `services/audio/music/music-voices.ts` builds one voice per note.
 * Times are seconds, frequencies Hz, gains linear.
 *
 * A tone is one oscillator with its own harmonic table (a periodic wave built once per player),
 * so the timbre is set here, without a filter node per note: the tables fall off fast, nothing
 * sharp sits in the high end. The envelope is click-free: a linear attack from silence, an
 * exponential fall to the sustain level, an exponential release after the note's end.
 */

export interface ToneInstrument {
  kind: 'tone';
  /** Amplitudes of the harmonics, the fundamental first. */
  harmonics: readonly number[];
  attack: number;
  /** Time constant of the fall from the peak to the sustain level. */
  decay: number;
  /** Sustain level, share of the peak; 0: the note only fades (a bell, a pluck). */
  sustain: number;
  /** Time constant of the fade after the note's end. */
  release: number;
  /** A second oscillator into the same envelope, detuned by this many cents (accordion reeds). */
  detuneCents?: number;
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

/** A short burst of filtered noise (shaker, brush, clock tick). */
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

export type Instrument = ToneInstrument | DrumInstrument | NoiseInstrument;

export const INSTRUMENTS = {
  /** Music box comb: almost a pure sine, a faint octave, fast attack and a long fade. */
  musicBox: {
    kind: 'tone',
    harmonics: [1, 0.1, 0.06, 0, 0.02],
    attack: 0.004,
    decay: 0.45,
    sustain: 0,
    release: 0.3,
  },
  /** Celesta: like the box but shorter (arpeggios and sparkles). */
  celesta: {
    kind: 'tone',
    harmonics: [1, 0.16, 0.04],
    attack: 0.005,
    decay: 0.2,
    sustain: 0,
    release: 0.15,
  },
  /** Soft round bass; the upper harmonics let a phone speaker hint at its pitch. */
  softBass: {
    kind: 'tone',
    harmonics: [1, 0.45, 0.22, 0.1, 0.04],
    attack: 0.014,
    decay: 0.45,
    sustain: 0.45,
    release: 0.1,
  },
  /** Warm pad: a triangle-like table, slow swell. */
  warmPad: {
    kind: 'tone',
    harmonics: [1, 0.12, 0.1, 0.03, 0.03],
    attack: 0.35,
    decay: 0.9,
    sustain: 0.75,
    release: 0.45,
  },
  /** Gentle waltz lead: a soft square, its odd harmonics rolled off like through a lowpass. */
  musette: {
    kind: 'tone',
    harmonics: [1, 0.05, 0.26, 0.03, 0.1, 0.01, 0.04],
    attack: 0.02,
    decay: 0.35,
    sustain: 0.55,
    release: 0.1,
  },
  /** Short piano-like pluck: the "pah" of the waltz. */
  pluck: {
    kind: 'tone',
    harmonics: [1, 0.4, 0.18, 0.08, 0.03],
    attack: 0.006,
    decay: 0.14,
    sustain: 0.12,
    release: 0.07,
  },
  /** Accordion-ish: two reeds a few cents apart, a soft swell. */
  accordion: {
    kind: 'tone',
    harmonics: [1, 0.45, 0.3, 0.15, 0.08, 0.04],
    attack: 0.09,
    decay: 0.5,
    sustain: 0.8,
    release: 0.14,
    detuneCents: 7,
  },
  /** Bright plucky lead of the run tune. */
  brightPluck: {
    kind: 'tone',
    harmonics: [1, 0.32, 0.26, 0.12, 0.09, 0.04, 0.03],
    attack: 0.005,
    decay: 0.17,
    sustain: 0.32,
    release: 0.07,
  },
  /** Plucky bass of the run tune. */
  pluckBass: {
    kind: 'tone',
    harmonics: [1, 0.55, 0.3, 0.15, 0.07],
    attack: 0.006,
    decay: 0.12,
    sustain: 0.28,
    release: 0.05,
  },
  /** Soft chord stab. */
  stab: {
    kind: 'tone',
    harmonics: [1, 0.25, 0.12, 0.05],
    attack: 0.01,
    decay: 0.12,
    sustain: 0.2,
    release: 0.08,
  },
  kick: { kind: 'drum', startFreq: 140, endFreq: 52, sweep: 0.09, attack: 0.003, decay: 0.1 },
  /** Clock tick of the music box. */
  tick: {
    kind: 'noise',
    filter: 'bandpass',
    cutoff: 1900,
    q: 1.4,
    attack: 0.002,
    decay: 0.022,
    spread: 0.06,
  },
  /** Brush of the waltz. */
  brush: {
    kind: 'noise',
    filter: 'bandpass',
    cutoff: 2600,
    q: 0.7,
    attack: 0.006,
    decay: 0.05,
    spread: 0.08,
  },
  /** Shaker of the run tune. */
  shaker: {
    kind: 'noise',
    filter: 'bandpass',
    cutoff: 3600,
    q: 1,
    attack: 0.003,
    decay: 0.026,
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
  /** Length of the shared noise buffer of a player. */
  noiseSeconds: 1,
} as const;
