import { MUSIC_TRACKS, type MusicTrackId } from '../../data/audio/music';
import { services } from '../../services';
import { audioLog } from '../../services/audio/audio-log';
import { MS_PER_SECOND as MS } from '../../util/math';

/** Seconds each track is given before the next one, and the wait before the first. */
const TRACK_SEC = 7;
const START_SEC = 3;

/**
 * The simulator trace of the sound test page (`VITE_AUDIO_TRACE=soundboard`): asks the music for
 * every track in turn the way the page's track buttons do (`services.audio.music.play`), and logs
 * what the player says a moment later. The sound is unlocked without a tap (the app needs none).
 */
export function runSoundboardTrace(): void {
  const tracks = Object.keys(MUSIC_TRACKS) as MusicTrackId[];
  services.audio.unlock();
  tracks.forEach((track, i) => {
    setTimeout(
      () => {
        audioLog.add(`board: button ${track}`);
        services.audio.music.play(track);
      },
      (START_SEC + i * TRACK_SEC) * MS,
    );
    setTimeout(
      () => {
        const s = services.audio.music.state();
        audioLog.add(`board: ${track} -> playing ${s.track ?? 'nothing'}, decks ${s.decks}`);
      },
      (START_SEC + (i + 1) * TRACK_SEC - 1) * MS,
    );
  });
}
