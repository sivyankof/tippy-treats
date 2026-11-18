import { MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';

/** The parts of `navigator` the audio session setup reads. */
export interface SessionNavigator {
  audioSession?: { type: string };
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

/** What the page may play: streamed tracks need media elements, which iOS before 16.4 cannot keep ambient. */
export interface AudioSessionInfo {
  /** Media elements may play (the long tracks are streamed through them). */
  streams: boolean;
  /** The page's audio session type was set to ambient. */
  ambient: boolean;
}

/** An iPhone, iPod or iPad (an iPad reports itself as a Mac with a touch screen). */
export function isAppleTouch(nav: SessionNavigator): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/**
 * Call before any audio context or media element exists (docs/06, section 7, "Выключатель звука
 * iPhone"): the page's audio session becomes ambient, so the whole game obeys the ring/silent
 * switch and mixes with another app's music instead of stopping it (a media element would put the
 * page into "playback" otherwise; an explicit page type overrides the elements' own). Where the
 * API is missing on an Apple touch device (iOS 15-16.3), media elements must not play at all.
 * Android and desktops are unchanged.
 */
export function setupAudioSession(nav: SessionNavigator | undefined): AudioSessionInfo {
  if (!nav) return { streams: true, ambient: false };
  const session = nav.audioSession;
  if (session) {
    try {
      session.type = 'ambient';
      return { streams: true, ambient: true };
    } catch {
      // An engine that refuses the type: treat it as missing.
    }
  }
  return { streams: !isAppleTouch(nav), ambient: false };
}

/** The tracks this page can play: without streams, the non-seamless ones are left out. */
export function playableTracks(
  tracks: readonly MusicTrackId[],
  streams: boolean,
): readonly MusicTrackId[] {
  return streams ? tracks : tracks.filter((track) => MUSIC_TRACKS[track].loop === 'seamless');
}
