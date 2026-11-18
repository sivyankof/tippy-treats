import {
  SFX,
  type NoiseRecipe,
  type TimedNoise,
  type TimedTone,
  type ToneRecipe,
} from '../../data/sfx';
import { WEATHER_BED, type BedKind } from '../../data/weather-bed';
import { makeBedBuffer, startBed } from './bed';
import { noiseBuffer } from './noise-buffer';
import type { Mixer } from './mixer';
import { runSource, type NodeTally } from './node-tally';

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
 * Sound building blocks over one audio context; everything goes into the mixer's sfx bus.
 * Every node is stopped at its end time and disconnected when it finishes (`runSource`).
 * `random` feeds the noise buffer and the pitch jitter of the sounds: live it is `Math.random`,
 * an offline render passes a seeded one so a render repeats exactly.
 */
export class Synth {
  private noiseBuffer: AudioBuffer | null = null;
  private bedBuffer: AudioBuffer | null = null;
  /** Start offset added to every note while `at` runs. */
  private base = 0;
  /** Latest end time (seconds from the context's now) of the notes scheduled since `measure` began. */
  private spanEnd = 0;
  /** Gain factor of the sound being scheduled (its level trim, `data/sound-trim.ts`). */
  private level = 1;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly mixer: Mixer,
    readonly random: () => number = Math.random,
  ) {}

  /** Current time of the context in seconds. */
  get now(): number {
    return this.ctx.currentTime;
  }

  get tally(): NodeTally {
    return this.mixer.tally;
  }

  /** The music switch is on (the combo bell is softer over the music). */
  get musicOn(): boolean {
    return this.mixer.musicIsOn;
  }

  /** Runs `sound` and returns how long it lasts in seconds, counted from the call to its last note's end. */
  measure(sound: () => void): number {
    const before = this.spanEnd;
    this.spanEnd = 0;
    try {
      sound();
      return this.spanEnd;
    } finally {
      this.spanEnd = Math.max(before, this.spanEnd);
    }
  }

  /** Runs `sound` with every note's gain multiplied by `factor` (the level trim of a sound). */
  scaled(factor: number, sound: () => void): void {
    const before = this.level;
    this.level = before * factor;
    try {
      sound();
    } finally {
      this.level = before;
    }
  }

  /** Runs `sound` with every note shifted `offset` seconds later (the offline render of several sounds). */
  at(offset: number, sound: () => void): void {
    const before = this.base;
    this.base = before + offset;
    try {
      sound();
    } finally {
      this.base = before;
    }
  }

  /** One oscillator note: attack ramp, exponential decay, optional pitch glide. */
  tone(recipe: ToneRecipe, options: PlayOptions = {}): void {
    const { ctx } = this;
    const pitch = options.pitch ?? 1;
    const peak = recipe.gain * (options.gain ?? 1) * this.level;
    const delay = this.base + (options.delay ?? 0);
    const start = ctx.currentTime + delay;
    const end = start + recipe.duration;
    this.spanEnd = Math.max(this.spanEnd, delay + recipe.duration + SFX.stopTail);

    const osc = ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(recipe.freq * pitch, start);
    if (recipe.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(recipe.endFreq * pitch, end);
    }
    const amp = ctx.createGain();
    this.envelope(amp, start, recipe.attack, end, peak);
    osc.connect(amp);
    amp.connect(this.mixer.sfxBus);
    runSource(this.mixer.tally, osc, [osc, amp], start, end + SFX.stopTail);
  }

  /** A burst of white noise through a filter with an optional cutoff glide. */
  noise(recipe: NoiseRecipe, options: PlayOptions = {}): void {
    const { ctx } = this;
    const pitch = options.pitch ?? 1;
    const peak = recipe.gain * (options.gain ?? 1) * this.level;
    const delay = this.base + (options.delay ?? 0);
    const start = ctx.currentTime + delay;
    const length = Math.min(recipe.duration, SFX.noise.bufferSeconds);
    const end = start + length;
    this.spanEnd = Math.max(this.spanEnd, delay + length + SFX.stopTail);

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
    amp.connect(this.mixer.sfxBus);
    runSource(this.mixer.tally, src, [src, filter, amp], start, end + SFX.stopTail);
  }

  /** A weather bed that plays `seconds` (the soundboard preview and the offline render; the game's own bed is `BedPlayer`). */
  bed(kind: BedKind, seconds: number): void {
    this.bedBuffer ??= makeBedBuffer(this.ctx, this.random);
    const delay = this.base;
    this.spanEnd = Math.max(this.spanEnd, delay + seconds + WEATHER_BED.stopTail);
    startBed(this.ctx, this.mixer, this.bedBuffer, WEATHER_BED.beds[kind], seconds, delay);
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

  private getNoiseBuffer(): AudioBuffer {
    this.noiseBuffer ??= noiseBuffer(this.ctx, SFX.noise.bufferSeconds, this.random);
    return this.noiseBuffer;
  }
}
