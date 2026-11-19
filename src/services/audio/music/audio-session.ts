import { MUSIC_TRACKS, type MusicTrackId } from '../../../data/audio/music';
import { isAppleTouch, type BrowserInfo } from '../../../util/browser-info';

/** What the page may play: streamed tracks need media elements, which iOS before 16.4 cannot keep ambient. */
export interface AudioSessionInfo {
  /** Media elements may play (the long tracks are streamed through them). */
  streams: boolean;
  /** The page's audio session type was set to ambient. */
  ambient: boolean;
}

const AMBIENT = 'ambient';

/**
 * Call before any audio context or media element exists (docs/06, section 7, "Выключатель звука
 * iPhone"). On an iPhone or iPad the page's audio session becomes ambient, so the whole game obeys
 * the ring/silent switch and mixes with another app's music instead of stopping it (a media
 * element would put the page into "playback" otherwise; an explicit page type overrides the
 * elements' own). The type is read back: an engine that ignores it counts as one without the API,
 * and there media elements must not play at all (iOS 15-16.3). Android and desktops are left as
 * they are, whatever they support.
 */
export function setupAudioSession(nav: BrowserInfo | undefined): AudioSessionInfo {
  if (!nav || !isAppleTouch(nav)) return { streams: true, ambient: false };
  const session = nav.audioSession;
  if (session) {
    try {
      session.type = AMBIENT;
      if (session.type === AMBIENT) return { streams: true, ambient: true };
    } catch {
      // An engine that refuses the type: treat it as missing.
    }
  }
  return { streams: false, ambient: false };
}

/** The tracks this page can play: without streams, the non-seamless ones are left out. */
export function playableTracks(
  tracks: readonly MusicTrackId[],
  streams: boolean,
): readonly MusicTrackId[] {
  return streams ? tracks : tracks.filter((track) => MUSIC_TRACKS[track].loop === 'seamless');
}
