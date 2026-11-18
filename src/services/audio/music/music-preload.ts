import { MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';
import { firstIndex } from './playlist-turn';
import { prepareLoop, type Decoded } from './tune-loop';

/** What the preload needs from the browser (fakes in tests). */
export interface PreloadDeps {
  random: () => number;
  /** The playlist this page plays (without streams, only its seamless tracks). */
  playlist: readonly MusicTrackId[];
  url(track: MusicTrackId): string | null;
  fetchBytes(url: string): Promise<ArrayBuffer>;
  /** Decodes without a live (unlocked) context: an offline context at the file's own rate. */
  decodeOffline(data: ArrayBuffer, sampleRate: number): Promise<AudioBuffer>;
  /** A media element for a streamed first track, or null when the page plays no streams. */
  makeElement(): HTMLMediaElement | null;
}

/**
 * The first track of the playlist, readied while the game loads (docs/06, section 7, "Запуск"),
 * so the music comes in right after the first tap: the track is picked here (the player takes the
 * same pick), a seamless one is fetched and decoded (an offline context needs no gesture), a
 * streamed one gets its media element with the file already loading. Each is taken once; a failure
 * leaves the player to load the track itself.
 */
export class MusicPreload {
  readonly index: number;
  readonly track: MusicTrackId | null;
  private decoded: Promise<Decoded> | null = null;
  private element: HTMLMediaElement | null = null;

  constructor(private readonly deps: PreloadDeps) {
    this.index = firstIndex(deps.random, deps.playlist.length);
    this.track = deps.playlist[this.index] ?? null;
  }

  /** Starts loading the first track (call once, as the game loads). */
  start(): void {
    const { track } = this;
    if (!track) return;
    const url = this.deps.url(track);
    if (!url) return;
    const spec = MUSIC_TRACKS[track];
    try {
      if (spec.loop === 'seamless') {
        const decoded = this.deps
          .fetchBytes(url)
          .then((data) => this.deps.decodeOffline(data, spec.sampleRate))
          .then((buffer) => ({ buffer, bounds: prepareLoop(buffer, track) }));
        // A failed preload is no error: the player loads the track itself.
        decoded.catch(() => undefined);
        this.decoded = decoded;
        return;
      }
      const el = this.deps.makeElement();
      if (!el) return;
      el.preload = 'auto';
      el.src = url;
      this.element = el;
    } catch {
      // The player loads the track itself.
    }
  }

  /** The decoded first track (once), or null. */
  takeDecoded(): { track: MusicTrackId; decoded: Promise<Decoded> } | null {
    const { decoded, track } = this;
    this.decoded = null;
    return decoded && track ? { track, decoded } : null;
  }

  /** The media element already loading the first track (once), or null. */
  takeElement(): HTMLMediaElement | null {
    const { element } = this;
    this.element = null;
    return element;
  }
}

/** The preload of the game: browser fetch, an offline context, `Audio` elements; idle outside a browser. */
export function createMusicPreload(
  playlist: readonly MusicTrackId[],
  streams: boolean,
  url: (track: MusicTrackId) => string | null,
): MusicPreload {
  const browser = typeof window !== 'undefined' && typeof OfflineAudioContext === 'function';
  return new MusicPreload({
    random: Math.random,
    playlist,
    url: browser ? url : () => null,
    fetchBytes: (address) =>
      fetch(address).then((response) => {
        if (!response.ok) throw new Error(`music file ${response.status}`);
        return response.arrayBuffer();
      }),
    decodeOffline: (data, sampleRate) =>
      new OfflineAudioContext(2, 1, sampleRate).decodeAudioData(data),
    makeElement: () => (streams && typeof Audio === 'function' ? new Audio() : null),
  });
}
