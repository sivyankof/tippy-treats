import {
  renderMany,
  renderSound,
  type Rendered,
  type TimedSound,
} from '../../services/audio/offline-render';
import { MUSIC, MUSIC_TRACKS, type MusicTrackId } from '../../data/music';
import { fetchAndDecode, trackUrl } from '../../services/audio/music/tune-loader';
import { loopBounds, prepareLoop } from '../../services/audio/music/tune-loop';
import { percentile } from '../perf/perf-stats';
import { clippedSamples, durationAboveFloor, peakDb, rmsDb } from '../../services/audio/levels';
import type { SoundArgs, SoundId } from '../../services/audio/sound-args';
import { SOUND_BOOK, SOUND_IDS, soundVariants } from '../../services/audio/sound-book';
import { encodeWav } from '../../services/audio/wav';
import { audioDev, services } from '../../services';
import type { MusicControl } from '../../services/audio/music-control';
import type { AudioDebugStats, MusicDebugState } from '../../services/audio/types';
import type { BedKind } from '../../data/weather-bed';

/** One renderable sound: an id with one argument set and the file-name stem it gets. */
export interface AudioHookEntry {
  id: SoundId;
  args: unknown[];
  /** `<id>` or `<id>-<label>`, safe in a file name. */
  name: string;
  /** The registry group of the sound (the level rule compares sounds within a group). */
  group: string;
}

/** Measurements of a render. */
export interface AudioHookLevels {
  seconds: number;
  /** Seconds the render stays above -60 dBFS. */
  audibleSec: number;
  peakDb: number;
  rmsDb: number;
  clipped: number;
}

export interface TippyAudioHook {
  /** Every registry sound, one entry per argument variant, in soundboard order. */
  ids: AudioHookEntry[];
  /** Renders offline: `{ sampleRate, channels }` with plain number arrays (for `page.evaluate`). */
  render(id: SoundId, args?: unknown[]): Promise<{ sampleRate: number; channels: number[][] }>;
  /** Renders offline and measures. */
  levels(id: SoundId, args?: unknown[]): Promise<AudioHookLevels>;
  /** Renders offline and returns the WAV file as base64. */
  wav(id: SoundId, args?: unknown[]): Promise<string>;
  /** Renders several sounds at offsets through the voice gate; reports the levels and what the gate refused. */
  many(list: TimedSound[]): Promise<AudioHookLevels & { refused: string[] }>;
  /** The same measurements for any rendered stretch. */
  measure(rendered: Rendered): AudioHookLevels;
  /** Same as `wav` for a rendered stretch. */
  encode(rendered: Rendered): string;
  /** The live service's `debugStats()`: live node count and context state. */
  stats(): AudioDebugStats;
  /** Every `play` the game made since the last `clearPlayLog` (id, arguments, `performance.now()` time), refused or not. */
  playLog(): PlayLogEntry[];
  clearPlayLog(): void;
  /** Starts a weather bed in the live game (`null` stops it), whatever `WEATHER_BED.enabled` says. */
  setBed(kind: BedKind | null): void;
  /** What the music was asked to play and the held ducks (null outside the development build). */
  music(): MusicDebugState | null;
  /** Resets the peak of the decoded music memory (the next `music()` reads the peak from now). */
  resetMusicPeak(): void;
  /** The live music control (dev scripts drive the playlist and the exceptions like the game does). */
  musicControl(): MusicControl;
  /**
   * The seam of a seamless track as the game plays it: the file decoded at `rate`, its loop bounds
   * and seam smoothing applied, rendered offline across the loop point.
   */
  musicSeam(track: MusicTrackId, rate: number, smooth?: boolean): Promise<SeamReport>;
}

/** Sample steps at the loop point against the rest of the render (a click stands out of the rest). */
export interface SeamReport {
  decodedFrames: number;
  loopStart: number;
  loopEnd: number;
  /** Largest |x[i] - x[i-1]| within `SEAM_SAMPLES` of the loop point, and the 99.9th percentile elsewhere. */
  seamStep: number;
  stepQ999: number;
  /** The same for the second difference |x[i] - 2x[i-1] + x[i-2]| (sharper for a kink in a slow wave). */
  seamCurve: number;
  curveQ999: number;
}

/** The seam render: this long on each side of the loop point. */
const SEAM_SIDE_SEC = 1;
/** Samples on each side of the loop point counted as "the seam". */
const SEAM_SAMPLES = 3;
const Q999 = 0.999;

async function musicSeam(track: MusicTrackId, rate: number, smooth = true): Promise<SeamReport> {
  const url = trackUrl(track);
  if (!url) throw new Error(`no file for ${track}`);
  const side = Math.round(SEAM_SIDE_SEC * rate);
  const ctx = new OfflineAudioContext(2, side * 2, rate);
  const buffer = await fetchAndDecode(ctx, url);
  const bounds = smooth
    ? prepareLoop(buffer, track)
    : loopBounds(buffer.length, MUSIC_TRACKS[track], rate, MUSIC.aacPrimingFrames);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = bounds.start / rate;
  source.loopEnd = bounds.end / rate;
  source.connect(ctx.destination);
  source.start(0, (bounds.end - side) / rate);
  const out = await ctx.startRendering();
  const steps: number[] = [];
  const curves: number[] = [];
  let seamStep = 0;
  let seamCurve = 0;
  for (let c = 0; c < out.numberOfChannels; c++) {
    const x = out.getChannelData(c);
    for (let i = 2; i < x.length; i++) {
      const step = Math.abs((x[i] ?? 0) - (x[i - 1] ?? 0));
      const curve = Math.abs((x[i] ?? 0) - 2 * (x[i - 1] ?? 0) + (x[i - 2] ?? 0));
      if (Math.abs(i - side) <= SEAM_SAMPLES) {
        seamStep = Math.max(seamStep, step);
        seamCurve = Math.max(seamCurve, curve);
      } else {
        steps.push(step);
        curves.push(curve);
      }
    }
  }
  return {
    decodedFrames: buffer.length,
    loopStart: bounds.start,
    loopEnd: bounds.end,
    seamStep,
    stepQ999: percentile(
      steps.sort((a, b) => a - b),
      Q999,
    ),
    seamCurve,
    curveQ999: percentile(
      curves.sort((a, b) => a - b),
      Q999,
    ),
  };
}

/** One logged call of `AudioService.play`. */
export interface PlayLogEntry {
  id: string;
  args: unknown[];
  at: number;
}

/** The play log keeps this many calls (a long run would otherwise grow it for ever). */
const PLAY_LOG_MAX = 2000;

function fileSafe(label: string): string {
  return label.replace(/[^a-zA-Z0-9.]+/g, '_').replace(/^_+|_+$/g, '');
}

function listEntries(): AudioHookEntry[] {
  return SOUND_IDS.flatMap((id) =>
    soundVariants(id).map((variant) => ({
      id,
      args: variant.args,
      name: variant.label === '' ? id : `${id}-${fileSafe(variant.label)}`,
      group: SOUND_BOOK[id].group,
    })),
  );
}

function measure(rendered: Rendered): AudioHookLevels {
  const { channels, sampleRate } = rendered;
  return {
    seconds: rendered.seconds,
    audibleSec: durationAboveFloor(channels, sampleRate),
    peakDb: peakDb(channels),
    rmsDb: rmsDb(channels),
    clipped: clippedSamples(channels),
  };
}

function toBase64(bytes: Uint8Array): string {
  let text = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(text);
}

function encode(rendered: Rendered): string {
  return toBase64(encodeWav(rendered.channels, rendered.sampleRate));
}

function renderAny(id: SoundId, args: unknown[] = []): Promise<Rendered> {
  return renderSound(id, args as SoundArgs[SoundId]);
}

/** Dev only: `window.__tippyAudio`, for Playwright scripts that render, save and measure the sounds. */
export function registerAudioHook(): void {
  let log: PlayLogEntry[] = [];
  const play = services.audio.play.bind(services.audio);
  services.audio.play = ((id: SoundId, ...args: unknown[]) => {
    if (log.length < PLAY_LOG_MAX) log.push({ id, args, at: performance.now() });
    (play as (id: SoundId, ...args: unknown[]) => void)(id, ...args);
  }) as typeof services.audio.play;
  const hook: TippyAudioHook = {
    ids: listEntries(),
    async render(id, args) {
      const r = await renderAny(id, args);
      return { sampleRate: r.sampleRate, channels: r.channels.map((c) => Array.from(c)) };
    },
    async levels(id, args) {
      return measure(await renderAny(id, args));
    },
    async wav(id, args) {
      return encode(await renderAny(id, args));
    },
    async many(list) {
      const r = await renderMany(list);
      return { ...measure(r), refused: r.refused };
    },
    measure,
    encode,
    stats: () => services.audio.debugStats(),
    playLog: () => log,
    setBed: (kind) => services.audio.setBed(kind),
    clearPlayLog: () => {
      log = [];
    },
    music: () => audioDev?.musicState() ?? null,
    resetMusicPeak: () => services.audio.music.resetPeak(),
    musicControl: () => services.audio.music,
    musicSeam,
  };
  (window as Window & { __tippyAudio?: TippyAudioHook }).__tippyAudio = hook;
}
