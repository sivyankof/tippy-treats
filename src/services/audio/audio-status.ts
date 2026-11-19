import type { MusicAsk, MusicTrackId } from '../../data/audio/music';

/** Everything the debug menu shows of the sound (one line, read once a second). */
export interface AudioStatus {
  /** Seconds since the page started. */
  uptimeSec: number;
  /** `AudioContext.state` (`interrupted` on iOS too), `none` before the audio is unlocked. */
  contextState: string;
  /** The context's clock, seconds; null without a context. */
  contextTime: number | null;
  musicOn: boolean;
  sfxOn: boolean;
  /** `navigator.audioSession.type`, `none` where the page has no such API. */
  session: string;
  /** Reasons the whole sound is held for (the app in the background, silent mode, an ad). */
  audioHolds: readonly string[];
  /** Reasons the music is held for (the app, a pause). */
  musicHolds: readonly string[];
  /** What the game asked of the music last. */
  asked: MusicAsk | null;
  /** The track playing or coming in. */
  track: MusicTrackId | null;
  /** The playlist plays (false: one track, or nothing). */
  playlist: boolean;
  /** Decks alive. */
  decks: number;
  /** A track was asked for and is still loading or starting. */
  loading: boolean;
  /** Peak level of the music bus over the last check, 0..1; null without a meter. */
  level: number | null;
  /** Times the watchdog started the playlist again. */
  restarts: number;
}

function list(items: readonly string[]): string {
  return items.length > 0 ? items.join(',') : '-';
}

function askText(ask: MusicAsk | null): string {
  if (!ask) return 'nothing';
  return ask.kind === 'playlist' ? 'playlist' : `track ${ask.track}`;
}

/** The status as one line of plain text (the debug menu and the copied report). */
export function formatAudioStatus(s: AudioStatus): string {
  const time = s.contextTime === null ? '' : ` t=${s.contextTime.toFixed(1)}`;
  const level = s.level === null ? '-' : s.level.toFixed(3);
  return [
    `up ${s.uptimeSec.toFixed(0)} s`,
    `ctx ${s.contextState}${time}`,
    `music ${s.musicOn ? 'on' : 'off'}, sfx ${s.sfxOn ? 'on' : 'off'}`,
    `session ${s.session}`,
    `asked ${askText(s.asked)}`,
    `${s.playlist ? 'playlist' : 'track'} ${s.track ?? '-'}${s.loading ? ' (loading)' : ''}`,
    `decks ${s.decks}`,
    `level ${level}`,
    `music holds ${list(s.musicHolds)}`,
    `sound holds ${list(s.audioHolds)}`,
    `restarts ${s.restarts}`,
  ].join(' | ');
}
