import {
  renderMany,
  renderSound,
  type Rendered,
  type TimedSound,
} from '../../services/audio/offline-render';
import { clippedSamples, durationAboveFloor, peakDb, rmsDb } from '../../services/audio/levels';
import type { SoundArgs, SoundId } from '../../services/audio/sound-args';
import { SOUND_IDS, soundVariants } from '../../services/audio/sound-book';
import { encodeWav } from '../../services/audio/wav';
import { services } from '../../services';
import type { AudioDebugStats } from '../../services/audio/types';
import type { BedKind } from '../../data/weather-bed';

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
  /** Every `play` the game made since the last `clearPlayLog` (id, arguments, `performance.now()` time), refused or not. */
  playLog(): PlayLogEntry[];
  clearPlayLog(): void;
  /** Starts a weather bed in the live game (`null` stops it), whatever `WEATHER_BED.enabled` says. */
  setBed(kind: BedKind | null): void;
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
  };
  (window as Window & { __tippyAudio?: TippyAudioHook }).__tippyAudio = hook;
}
