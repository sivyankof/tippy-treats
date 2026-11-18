import { AUDIO_MIX } from '../../data/audio-mix';
import { Rng } from '../../core/rng';
import { Mixer } from './mixer';
import {
  musicHostOf,
  type MusicFactory,
  type MusicHost,
  type MusicStartOptions,
} from './music-control';
import type { SoundArgs, SoundId } from './sound-args';
import { SoundPlayer } from './sound-player';
import { TunePlayer, type TuneChange } from './music/tune-player';
import type { MusicVariant } from './music-control';
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

/** What a render builds on: the context, the mixer, a synth and a gated sound player, and a music host. */
export interface RenderRig {
  ctx: OfflineAudioContext;
  mixer: Mixer;
  synth: Synth;
  player: SoundPlayer;
  host: MusicHost;
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
 * `renderSound`, `renderMany` and `renderMusic` are thin users of it.
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
    host: musicHostOf(mixer, next),
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

/**
 * Extension point for the music (theme C): renders `seconds` of the tune a player built by `factory`
 * makes, from the start options, through the same chain (music bus included).
 */
export function renderMusic(
  factory: MusicFactory,
  start: MusicStartOptions,
  seconds: number,
  options: RenderOptions = {},
): Promise<Rendered> {
  return renderOffline(
    (rig) => {
      factory(rig.host).start(start);
      return seconds;
    },
    { ...options, seconds },
  );
}

/** Options of `renderTune`: the render options, the menu arrangement and changes along the way. */
export interface TuneRenderOptions extends RenderOptions {
  menu?: boolean;
  /** Layer or menu changes at their times (seconds from the start), e.g. the climb through the zones. */
  changes?: readonly TuneChange[];
  /** Measurements only: render this part (index) alone. */
  only?: number;
}

/**
 * Renders `seconds` of a tune at `layer` through the same chain as live (music bus, master,
 * limiter): the player schedules the whole stretch up front.
 */
export function renderTune(
  variant: MusicVariant,
  layer: number,
  seconds: number,
  options: TuneRenderOptions = {},
): Promise<Rendered> {
  const { menu, changes, only, ...render } = options;
  return renderMusic(
    (host) => new TunePlayer(host, { seconds, changes, only }),
    { variant, layer, menu },
    seconds,
    render,
  );
}
