import {
  renderMany,
  renderSound,
  renderTune,
  type Rendered,
  type TimedSound,
  type TuneRenderOptions,
} from '../../services/audio/offline-render';
import { SONGS, type MusicVariant } from '../../data/music/songs';
import { MUSIC_PLAY } from '../../data/music/music-play';
import { songTiming } from '../../services/audio/music/music-schedule';
import {
  dcOffset,
  denormalSamples,
  seamDb,
  stretchRmsDb,
} from '../../services/audio/music/tune-levels';
import { clippedSamples, durationAboveFloor, peakDb, rmsDb } from '../../services/audio/levels';
import type { SoundArgs, SoundId } from '../../services/audio/sound-args';
import { SOUND_IDS, soundVariants } from '../../services/audio/sound-book';
import { encodeWav } from '../../services/audio/wav';
import { audioDev, services } from '../../services';
import type { AudioDebugStats, MusicDebugState } from '../../services/audio/types';

/** One renderable sound: an id with one argument set and the file-name stem it gets. */
export interface AudioHookEntry {
  id: SoundId;
  args: unknown[];
  /** `<id>` or `<id>-<label>`, safe in a file name. */
  name: string;
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
  /** Extension point for the music (theme C): the same measurements for any rendered stretch. */
  measure(rendered: Rendered): AudioHookLevels;
  /** Same as `wav` for a rendered stretch. */
  encode(rendered: Rendered): string;
  /** The live service's `debugStats()`: live node count and context state. */
  stats(): AudioDebugStats;
  /** What the music was asked to play and the held ducks (null outside the development build). */
  music(): MusicDebugState | null;
  /** Renders `seconds` of a tune at a layer offline and measures it (`wav: true` adds the file). */
  tune(
    variant: MusicVariant,
    layer: number,
    seconds: number,
    options?: TuneHookOptions,
  ): Promise<TuneHookReport>;
}

export interface TuneHookOptions extends TuneRenderOptions {
  wav?: boolean;
  /** Length of the stretches of `stretchesDb`, seconds (default 10). */
  stretchSec?: number;
}

/** What `tune` measures: the levels, the loop seam (the 0.5 s before and after the first loop end), DC, denormals. */
export interface TuneHookReport extends AudioHookLevels {
  loopSec: number;
  seam: { before: number; after: number; diff: number } | null;
  /** The same reading at the bar line in the middle of the loop: what an ordinary phrase boundary looks like. */
  midSeam: { before: number; after: number; diff: number } | null;
  dc: number;
  denormals: number;
  /** RMS of each stretch of `stretchSec`, dBFS. */
  stretchesDb: number[];
  wav?: string;
}

/** The seam is measured over this much on each side of the loop end. */
const SEAM_SPAN_SEC = 0.5;
const STRETCH_SEC = 10;

async function tuneReport(
  variant: MusicVariant,
  layer: number,
  seconds: number,
  options: TuneHookOptions = {},
): Promise<TuneHookReport> {
  const { wav, stretchSec = STRETCH_SEC, ...render } = options;
  const r = await renderTune(variant, layer, seconds, render);
  const song = SONGS[variant];
  const { loopSec, barSec } = songTiming(song);
  const midAt = Math.floor(song.bars / 2) * barSec + MUSIC_PLAY.startLeadSec;
  // The first note sounds `startLeadSec` after the start of the render.
  const seamAt = loopSec + MUSIC_PLAY.startLeadSec;
  const stretchesDb: number[] = [];
  for (let t = 0; t < r.seconds; t += stretchSec) {
    stretchesDb.push(stretchRmsDb(r.channels, r.sampleRate, t, t + stretchSec));
  }
  return {
    ...measure(r),
    loopSec,
    seam:
      seamAt + SEAM_SPAN_SEC <= r.seconds
        ? seamDb(r.channels, r.sampleRate, seamAt, SEAM_SPAN_SEC)
        : null,
    midSeam:
      midAt + SEAM_SPAN_SEC <= r.seconds
        ? seamDb(r.channels, r.sampleRate, midAt, SEAM_SPAN_SEC)
        : null,
    dc: dcOffset(r.channels),
    denormals: denormalSamples(r.channels),
    stretchesDb,
    ...(wav ? { wav: encode(r) } : {}),
  };
}

function fileSafe(label: string): string {
  return label.replace(/[^a-zA-Z0-9.]+/g, '_').replace(/^_+|_+$/g, '');
}

function listEntries(): AudioHookEntry[] {
  return SOUND_IDS.flatMap((id) =>
    soundVariants(id).map((variant) => ({
      id,
      args: variant.args,
      name: variant.label === '' ? id : `${id}-${fileSafe(variant.label)}`,
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
    tune: tuneReport,
    music: () => audioDev?.musicState() ?? null,
  };
  (window as Window & { __tippyAudio?: TippyAudioHook }).__tippyAudio = hook;
}
