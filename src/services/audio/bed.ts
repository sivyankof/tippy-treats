import { SFX } from '../../data/sfx';
import { WEATHER_BED, type BedKind, type BedRecipe } from '../../data/weather-bed';
import type { Mixer } from './mixer';
import { noiseBuffer } from './noise-buffer';

/** A looped bed that can be stopped (it fades out and frees its nodes). */
export interface BedVoice {
  stop(): void;
}

/** A buffer of white noise for a bed, `WEATHER_BED.bufferSeconds` long. */
export function makeBedBuffer(ctx: BaseAudioContext, random: () => number): AudioBuffer {
  return noiseBuffer(ctx, WEATHER_BED.bufferSeconds, random);
}

/**
 * Starts one bed: looped noise -> filter -> gain -> sfx bus, the gain swelling slowly by a sine
 * oscillator that is added to it. Five nodes in all, made once (never per frame), all stopped
 * and disconnected when the bed ends. With `seconds` it fades in, holds and fades out by itself
 * (the soundboard and the offline render); without, it plays until `stop()`.
 */
export function startBed(
  ctx: BaseAudioContext,
  mixer: Mixer,
  buffer: AudioBuffer,
  recipe: BedRecipe,
  seconds: number | null,
  delay = 0,
): BedVoice {
  const start = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = recipe.filter;
  filter.frequency.value = recipe.cutoff;
  filter.Q.value = recipe.q;
  const amp = ctx.createGain();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = recipe.swell.rateHz;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = recipe.gain * recipe.swell.depth;
  src.connect(filter);
  filter.connect(amp);
  amp.connect(mixer.sfxBus);
  lfo.connect(lfoGain);
  lfoGain.connect(amp.gain);

  const nodes = [src, filter, amp, lfo, lfoGain];
  mixer.tally.add(nodes);
  src.onended = () => {
    for (const node of nodes) node.disconnect();
    mixer.tally.release(nodes);
  };
  amp.gain.setValueAtTime(SFX.silence, start);
  amp.gain.linearRampToValueAtTime(recipe.gain, start + recipe.fadeInSec);
  src.start(start);
  lfo.start(start);
  let stopped = false;
  const endAt = (at: number): void => {
    stopped = true;
    src.stop(at);
    lfo.stop(at);
  };
  if (seconds !== null) {
    const fadeStart = start + Math.max(recipe.fadeInSec, seconds - recipe.fadeOutSec);
    amp.gain.setValueAtTime(recipe.gain, fadeStart);
    amp.gain.linearRampToValueAtTime(SFX.silence, start + seconds);
    endAt(start + seconds + WEATHER_BED.stopTail);
  }
  return {
    stop(): void {
      if (stopped) return;
      const now = ctx.currentTime;
      const level = Math.max(amp.gain.value, SFX.silence);
      amp.gain.cancelScheduledValues(now);
      amp.gain.setValueAtTime(level, now);
      amp.gain.linearRampToValueAtTime(SFX.silence, now + recipe.fadeOutSec);
      endAt(now + recipe.fadeOutSec + WEATHER_BED.stopTail);
    },
  };
}

/** The one live bed of the game: `set` starts the bed of a kind (or none), fading the old one out. */
export class BedPlayer {
  private buffer: AudioBuffer | null = null;
  private voice: BedVoice | null = null;
  private kind: BedKind | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly mixer: Mixer,
    private readonly random: () => number,
  ) {}

  set(kind: BedKind | null): void {
    if (kind === this.kind) return;
    this.voice?.stop();
    this.voice = null;
    this.kind = kind;
    if (kind === null) return;
    this.buffer ??= makeBedBuffer(this.ctx, this.random);
    this.voice = startBed(this.ctx, this.mixer, this.buffer, WEATHER_BED.beds[kind], null);
  }
}
