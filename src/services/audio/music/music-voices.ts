import {
  INSTRUMENTS,
  MUSIC_VOICE,
  type DrumInstrument,
  type InstrumentId,
  type NoiseInstrument,
  type ToneInstrument,
} from '../../../data/music/instruments';
import { runSource, type NodeTally, type TimedSource } from '../node-tally';
import { noteFreq } from '../notes';

/** One note for an instrument: context time, length in seconds, pitch from C4, peak gain. */
export interface VoiceNote {
  time: number;
  length: number;
  pitch: number;
  gain: number;
}

/**
 * Builds one voice per note of the music: 2 nodes for a tone or a kick, 3 for a detuned tone or
 * a noise hit. Every voice goes through `runSource` (stopped when its fade is inaudible,
 * disconnected and released once it ends). The periodic waves and the noise buffer are built
 * once per player.
 */
export class MusicVoices {
  private readonly waves = new Map<InstrumentId, PeriodicWave>();
  private noise: AudioBuffer | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly tally: NodeTally,
    private readonly random: () => number,
  ) {}

  /** Starts the voice of `note` into `out`; `onEnd` runs once it has ended. Returns its source. */
  play(id: InstrumentId, note: VoiceNote, out: AudioNode, onEnd: () => void): TimedSource {
    const recipe = INSTRUMENTS[id];
    const source =
      recipe.kind === 'tone'
        ? this.tone(id, recipe, note, out)
        : recipe.kind === 'drum'
          ? this.drum(recipe, note, out)
          : this.noiseHit(recipe, note, out);
    const release = source.onended;
    source.onended = (event: Event) => {
      release?.call(source, event);
      onEnd();
    };
    return source;
  }

  private tone(id: InstrumentId, recipe: ToneInstrument, note: VoiceNote, out: AudioNode) {
    const { ctx } = this;
    const { time, gain } = note;
    const freq = noteFreq(MUSIC_VOICE.c4Hz, note.pitch);
    const wave = this.wave(id, recipe);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(freq, time);
    const amp = ctx.createGain();
    const peakAt = time + recipe.attack;
    const end = Math.max(peakAt, time + note.length);
    const param = amp.gain;
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(gain, peakAt);
    param.setTargetAtTime(gain * recipe.sustain, peakAt, recipe.decay);
    param.setTargetAtTime(0, end, recipe.release);
    const taus = MUSIC_VOICE.stopTaus;
    const released = end + taus * recipe.release;
    const stopAt =
      recipe.sustain === 0 ? Math.min(released, peakAt + taus * recipe.decay) : released;
    osc.connect(amp);
    amp.connect(out);
    const nodes: AudioNode[] = [osc, amp];
    if (recipe.detuneCents !== undefined) {
      const reed = ctx.createOscillator();
      reed.setPeriodicWave(wave);
      reed.frequency.setValueAtTime(freq, time);
      reed.detune.setValueAtTime(recipe.detuneCents, time);
      reed.connect(amp);
      nodes.push(reed);
      reed.start(time);
      reed.stop(stopAt);
    }
    runSource(this.tally, osc, nodes, time, stopAt);
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
    if (!this.noise) {
      const length = Math.ceil(this.ctx.sampleRate * MUSIC_VOICE.noiseSeconds);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = this.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }
}
