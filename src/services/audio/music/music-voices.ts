import {
  INSTRUMENTS,
  MUSIC_VOICE,
  type DrumInstrument,
  type InstrumentId,
  type KeysInstrument,
  type KeysPartial,
  type NoiseInstrument,
  type ToneInstrument,
} from '../../../data/music/instruments';
import { runSource, stopQuietly, type NodeTally } from '../node-tally';
import { noiseBuffer } from '../noise-buffer';
import { noteFreq } from '../notes';

/** Odd harmonics of the electric piano's triangle (the 2 kHz keys filter takes the rest). */
const TRIANGLE_HARMONICS = 6;

/** A playing voice: `stop` cuts every oscillator of it at a context time (the tune stops). */
export interface VoiceHandle {
  stop(when: number): void;
}

/** One note for an instrument: context time, length in seconds, pitch from C4, peak gain. */
export interface VoiceNote {
  time: number;
  length: number;
  pitch: number;
  gain: number;
}

/**
 * Builds one voice per note of the music: 3 nodes for an electric-piano note (two oscillators,
 * one envelope), 2 for a tone or a kick, 3 for a noise hit. Every voice goes through `runSource`
 * (stopped when its fade is inaudible, disconnected and released once it ends). The periodic
 * waves and the noise buffer are built once per player; the electric piano's oscillators take
 * their slow pitch wobble from the one LFO of the music chain (`wobble`), let go with the voice.
 */
export class MusicVoices {
  private readonly waves = new Map<InstrumentId, PeriodicWave>();
  private readonly partialWaves = new Map<string, PeriodicWave>();
  private noise: AudioBuffer | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly tally: NodeTally,
    private readonly random: () => number,
    private readonly wobble: AudioNode | null = null,
  ) {}

  /** Starts the voice of `note` into `out`; `onEnd` runs once it has ended. */
  play(id: InstrumentId, note: VoiceNote, out: AudioNode, onEnd: () => void): VoiceHandle {
    const recipe = INSTRUMENTS[id];
    const voice =
      recipe.kind === 'keys'
        ? this.keys(id, recipe, note, out)
        : {
            sources: [
              recipe.kind === 'tone'
                ? this.tone(id, recipe, note, out)
                : recipe.kind === 'drum'
                  ? this.drum(recipe, note, out)
                  : this.noiseHit(recipe, note, out),
            ],
            cleanup: null,
          };
    const [source] = voice.sources;
    if (source) {
      const release = source.onended;
      source.onended = (event: Event) => {
        // The voice must leave the player's list however its clean-up goes.
        try {
          release?.call(source, event);
          voice.cleanup?.();
        } finally {
          onEnd();
        }
      };
    }
    return {
      stop: (when) => {
        for (const s of voice.sources) stopQuietly(s, when);
      },
    };
  }

  /** Attack from silence to `gain`, a fade with `decay` towards `sustain` of it, a release after `end`. */
  private envelope(
    param: AudioParam,
    time: number,
    attack: number,
    decay: number,
    sustain: number,
    release: number,
    end: number,
    gain: number,
    taus: number = MUSIC_VOICE.stopTaus,
  ): number {
    const peakAt = time + attack;
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(gain, peakAt);
    param.setTargetAtTime(gain * sustain, peakAt, decay);
    const releaseAt = Math.max(peakAt, end);
    param.setTargetAtTime(0, releaseAt, release);
    const released = releaseAt + taus * release;
    return sustain === 0 ? Math.min(released, peakAt + taus * decay) : released;
  }

  private keys(id: InstrumentId, recipe: KeysInstrument, note: VoiceNote, out: AudioNode) {
    const { ctx } = this;
    const { time } = note;
    const freq = noteFreq(MUSIC_VOICE.c4Hz, note.pitch);
    const amp = ctx.createGain();
    const stopAt = this.envelope(
      amp.gain,
      time,
      recipe.attack,
      recipe.decay,
      0,
      recipe.release,
      time + note.length,
      note.gain,
      MUSIC_VOICE.keysStopTaus,
    );
    const oscs = recipe.partials.map((partial, i) => {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.partialWave(id, i, partial));
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(partial.detuneCents, time);
      osc.connect(amp);
      this.wobble?.connect(osc.detune);
      return osc;
    });
    amp.connect(out);
    const [first, ...others] = oscs;
    for (const osc of others) {
      osc.start(time);
      osc.stop(stopAt);
    }
    if (first) runSource(this.tally, first, [...oscs, amp], time, stopAt);
    const cleanup = (): void => {
      const { wobble } = this;
      if (!wobble) return;
      for (const osc of oscs) {
        try {
          wobble.disconnect(osc.detune);
        } catch {
          // Not connected any more.
        }
      }
    };
    return { sources: oscs, cleanup };
  }

  private tone(id: InstrumentId, recipe: ToneInstrument, note: VoiceNote, out: AudioNode) {
    const { ctx } = this;
    const { time } = note;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave(id, recipe));
    osc.frequency.setValueAtTime(noteFreq(MUSIC_VOICE.c4Hz, note.pitch), time);
    const amp = ctx.createGain();
    const stopAt = this.envelope(
      amp.gain,
      time,
      recipe.attack,
      recipe.decay,
      recipe.sustain,
      recipe.release,
      time + note.length,
      note.gain,
    );
    osc.connect(amp);
    amp.connect(out);
    runSource(this.tally, osc, [osc, amp], time, stopAt);
    return osc;
  }

  private drum(recipe: DrumInstrument, note: VoiceNote, out: AudioNode) {
    const { ctx } = this;
    const { time } = note;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(recipe.startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(recipe.endFreq, time + recipe.sweep);
    const amp = ctx.createGain();
    const stopAt = this.hitEnvelope(amp, time, recipe.attack, recipe.decay, note.gain);
    osc.connect(amp);
    amp.connect(out);
    runSource(this.tally, osc, [osc, amp], time, stopAt);
    return osc;
  }

  private noiseHit(recipe: NoiseInstrument, note: VoiceNote, out: AudioNode) {
    const { ctx } = this;
    const { time } = note;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.playbackRate.setValueAtTime(1 + (this.random() * 2 - 1) * recipe.spread, time);
    const filter = ctx.createBiquadFilter();
    filter.type = recipe.filter;
    filter.frequency.setValueAtTime(recipe.cutoff, time);
    filter.Q.setValueAtTime(recipe.q, time);
    const amp = ctx.createGain();
    const stopAt = this.hitEnvelope(amp, time, recipe.attack, recipe.decay, note.gain);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(out);
    runSource(this.tally, src, [src, filter, amp], time, stopAt);
    return src;
  }

  /** Attack from silence, then a fade with time constant `decay`; returns when the voice may stop. */
  private hitEnvelope(amp: GainNode, time: number, attack: number, decay: number, gain: number) {
    const param = amp.gain;
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(gain, time + attack);
    param.setTargetAtTime(0, time + attack, decay);
    return time + attack + MUSIC_VOICE.stopTaus * decay;
  }

  /**
   * The wave of one electric-piano oscillator at its own level (normalization off, so the
   * partial's gain is in the wave and the note needs one envelope node): a sine, or a triangle
   * from its odd harmonics (8/pi^2, alternating, falling as 1/n^2).
   */
  private partialWave(id: InstrumentId, index: number, partial: KeysPartial): PeriodicWave {
    const key = `${id}:${index}`;
    let wave = this.partialWaves.get(key);
    if (!wave) {
      const size = partial.wave === 'sine' ? 2 : TRIANGLE_HARMONICS * 2;
      const real = new Float32Array(size);
      const imag = new Float32Array(size);
      if (partial.wave === 'sine') imag[1] = partial.gain;
      else {
        for (let k = 0; k < TRIANGLE_HARMONICS; k++) {
          const n = 2 * k + 1;
          imag[n] = ((k % 2 === 0 ? 1 : -1) * partial.gain * 8) / (Math.PI * Math.PI * n * n);
        }
      }
      wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
      this.partialWaves.set(key, wave);
    }
    return wave;
  }

  private wave(id: InstrumentId, recipe: ToneInstrument): PeriodicWave {
    let wave = this.waves.get(id);
    if (!wave) {
      const size = recipe.harmonics.length + 1;
      const real = new Float32Array(size);
      const imag = new Float32Array(size);
      recipe.harmonics.forEach((amplitude, i) => {
        imag[i + 1] = amplitude;
      });
      wave = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(id, wave);
    }
    return wave;
  }

  private noiseBuffer(): AudioBuffer {
    this.noise ??= noiseBuffer(this.ctx, MUSIC_VOICE.noiseSeconds, this.random);
    return this.noise;
  }
}
