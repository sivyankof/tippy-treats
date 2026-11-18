import { AUDIO_MIX } from '../../data/audio-mix';
import { Rng } from '../../core/rng';
import { Mixer } from './mixer';
import type { SoundArgs, SoundId } from './sound-args';
import { SoundPlayer } from './sound-player';
import { Synth } from './synth';

/**
 * Offline rendering: the same chain as live (`Mixer`: buses, compressor, limiter) over an
 * `OfflineAudioContext`, so a render is what the player hears, and can be saved as a WAV and
 * measured (`wav.ts`, `levels.ts`). Randomness is seeded, so a render repeats exactly.
 */

export interface RenderOptions {
  sampleRate?: number;
  channels?: number;
  /** Seed of the random numbers of the render (pitch jitter, noise). */
  seed?: number;
  /** Silence kept after the last sound, seconds. */
  tailSec?: number;
  /** Fixed length of the render, seconds; by default the render is as long as its sounds plus the tail. */
  seconds?: number;
}

/** A rendered stretch of audio. */
export interface Rendered {
  sampleRate: number;
  channels: Float32Array[];
  /** Length in seconds. */
  seconds: number;
}

/** What a render builds on: the context, the mixer, a synth and a gated sound player. */
export interface RenderRig {
  ctx: OfflineAudioContext;
  mixer: Mixer;
  synth: Synth;
  player: SoundPlayer;
}

/** One entry of `renderMany`: a sound starting `at` seconds from the start of the render. */
export interface TimedSound<K extends SoundId = SoundId> {
  id: K;
  args: SoundArgs[K];
  at: number;
}

export interface RenderedMany extends Rendered {
  /** The sounds the voice gate refused (the same gate as live), as `id@at`. */
  refused: string[];
}

/**
 * The general renderer: `build` schedules everything on the rig and returns the length of the
 * material in seconds; the result is that long plus the tail (or `options.seconds` exactly).
 * `renderSound` and `renderMany` are thin users of it.
 */
export async function renderOffline(
  build: (rig: RenderRig) => number,
  options: RenderOptions = {},
): Promise<Rendered> {
  const mix = AUDIO_MIX.offline;
  const sampleRate = options.sampleRate ?? mix.sampleRate;
  const channelCount = options.channels ?? mix.channels;
  const capacity = options.seconds ?? mix.maxSeconds;
  const ctx = new OfflineAudioContext(channelCount, Math.ceil(capacity * sampleRate), sampleRate);
  const random = new Rng(options.seed ?? mix.noiseSeed);
  const next = (): number => random.next();
  const mixer = new Mixer(ctx);
  // The context is a BaseAudioContext; the synth only needs that much.
  const synth = new Synth(ctx, mixer, next);
  const rig: RenderRig = {
    ctx,
    mixer,
    synth,
    player: new SoundPlayer(synth),
  };
  const material = build(rig);
  const buffer = await ctx.startRendering();
  const seconds =
    options.seconds ?? Math.min(capacity, material + (options.tailSec ?? mix.tailSec));
  const frames = Math.min(buffer.length, Math.ceil(seconds * sampleRate));
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c).slice(0, frames));
  }
  return { sampleRate, channels, seconds: frames / sampleRate };
}

/** Renders one sound with one set of arguments, from the start of the render. */
export function renderSound<K extends SoundId>(
  id: K,
  args: SoundArgs[K],
  options: RenderOptions = {},
): Promise<Rendered> {
  return renderOffline((rig) => {
    const result = rig.player.play(id, args);
    return result.played ? result.length : 0;
  }, options);
}

/**
 * Renders several sounds at chosen offsets through the voice gate (the "all at once" check):
 * what the gate would refuse live is refused here and listed in `refused`.
 */
export async function renderMany(
  list: readonly TimedSound[],
  options: RenderOptions = {},
): Promise<RenderedMany> {
  const refused: string[] = [];
  const rendered = await renderOffline((rig) => {
    let end = 0;
    for (const sound of [...list].sort((a, b) => a.at - b.at)) {
      const result = rig.player.play(sound.id, sound.args, sound.at);
      if (result.played) end = Math.max(end, result.length);
      else refused.push(`${sound.id}@${sound.at}`);
    }
    return end;
  }, options);
  return { ...rendered, refused };
}
