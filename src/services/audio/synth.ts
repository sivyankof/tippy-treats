import {
  SFX,
  type NoiseRecipe,
  type TimedNoise,
  type TimedTone,
  type ToneRecipe,
} from '../../data/sfx';

/** Per-call adjustments of a recipe. */
export interface PlayOptions {
  /** Start offset in seconds from now. */
  delay?: number;
  /** Multiplier of the recipe gain. */
  gain?: number;
  /** Multiplier of the recipe frequencies. */
  pitch?: number;
}

/**
 * Sound building blocks over one audio context: master gain -> compressor -> destination.
 * Every node is stopped at its end time and disconnected when it finishes.
 */
export class Synth {
  private readonly input: GainNode;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(private readonly ctx: AudioContext) {
    this.input = ctx.createGain();
    this.input.gain.value = SFX.master.gain;
    const comp = ctx.createDynamicsCompressor();
    const cfg = SFX.master.compressor;
    comp.threshold.value = cfg.threshold;
    comp.knee.value = cfg.knee;
    comp.ratio.value = cfg.ratio;
    comp.attack.value = cfg.attack;
    comp.release.value = cfg.release;
    this.input.connect(comp);
    comp.connect(ctx.destination);
  }

  /** Current time of the context in seconds. */
  get now(): number {
    return this.ctx.currentTime;
  }

  /** One oscillator note: attack ramp, exponential decay, optional pitch glide. */
  tone(recipe: ToneRecipe, options: PlayOptions = {}): void {
    const { ctx } = this;
    const pitch = options.pitch ?? 1;
    const peak = recipe.gain * (options.gain ?? 1);
    const start = ctx.currentTime + (options.delay ?? 0);
    const end = start + recipe.duration;

    const osc = ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(recipe.freq * pitch, start);
    if (recipe.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(recipe.endFreq * pitch, end);
    }
    const amp = ctx.createGain();
    this.envelope(amp, start, recipe.attack, end, peak);
    osc.connect(amp);
    amp.connect(this.input);
    this.finish(osc, [osc, amp], start, end + SFX.stopTail);
  }

  /** A burst of white noise through a filter with an optional cutoff glide. */
  noise(recipe: NoiseRecipe, options: PlayOptions = {}): void {
    const { ctx } = this;
    const pitch = options.pitch ?? 1;
    const peak = recipe.gain * (options.gain ?? 1);
    const start = ctx.currentTime + (options.delay ?? 0);
    const end = start + Math.min(recipe.duration, SFX.noise.bufferSeconds);

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = recipe.filter;
    filter.Q.value = recipe.q;
    filter.frequency.setValueAtTime(recipe.cutoff * pitch, start);
    if (recipe.endCutoff !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(recipe.endCutoff * pitch, end);
    }
    const amp = ctx.createGain();
    this.envelope(amp, start, recipe.attack, end, peak);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.input);
    this.finish(src, [src, filter, amp], start, end + SFX.stopTail);
  }

  /** Notes with their own start offsets (arpeggios, ability sounds), shifted by `options`. */
  sequence(notes: readonly TimedTone[], options: PlayOptions = {}): void {
    for (const note of notes) {
      this.tone(note, { ...options, delay: (options.delay ?? 0) + note.delay });
    }
  }

  /** Noise bursts with their own start offsets. */
  noiseSequence(bursts: readonly TimedNoise[], options: PlayOptions = {}): void {
    for (const burst of bursts) {
      this.noise(burst, { ...options, delay: (options.delay ?? 0) + burst.delay });
    }
  }

  /** Several frequencies of one recipe at once, each `stagger` seconds after the previous. */
  chord(
    recipe: Omit<ToneRecipe, 'freq'>,
    freqs: readonly number[],
    stagger: number,
    options: PlayOptions = {},
  ): void {
    freqs.forEach((freq, i) => {
      this.tone({ ...recipe, freq }, { ...options, delay: (options.delay ?? 0) + i * stagger });
    });
  }

  /** Click-free envelope: linear attack to `peak`, exponential decay down to the silence floor. */
  private envelope(amp: GainNode, start: number, attack: number, end: number, peak: number): void {
    const param = amp.gain;
    param.setValueAtTime(SFX.silence, start);
    param.linearRampToValueAtTime(Math.max(peak, SFX.silence), start + attack);
    param.exponentialRampToValueAtTime(SFX.silence, end);
  }

  /** Schedules the source and cleans everything up once it ends. */
  private finish(
    source: OscillatorNode | AudioBufferSourceNode,
    nodes: readonly AudioNode[],
    start: number,
    stopAt: number,
  ): void {
    source.onended = () => {
      for (const node of nodes) node.disconnect();
    };
    source.start(start);
    source.stop(stopAt);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.ceil(this.ctx.sampleRate * SFX.noise.bufferSeconds);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}
