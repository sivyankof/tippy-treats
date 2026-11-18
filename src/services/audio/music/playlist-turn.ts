/**
 * Pure arithmetic of the playlist (docs/06, section 7, "Плейлист"): how long a track's turn is,
 * where a turn resumes, which track comes next. Times are seconds.
 */

/** What a turn needs to know of a track: its loop (or file) length and whether it is seamless. */
export interface TurnTrack {
  /** Length of one loop of a seamless track, or of the whole file of a non-seamless one. */
  loopSec: number;
  seamless: boolean;
}

/**
 * How long a track plays before the change to the next one starts: a seamless loop whole rounds
 * until at least `minPlaySec` (the change starts on a loop boundary); a non-seamless file once,
 * the change starting `crossfadeSec` before its end so it ends with the file.
 */
export function turnLength(track: TurnTrack, minPlaySec: number, crossfadeSec: number): number {
  if (track.loopSec <= 0) return 0;
  if (!track.seamless) return Math.max(0, track.loopSec - crossfadeSec);
  return Math.max(1, Math.ceil(minPlaySec / track.loopSec - 1e-9)) * track.loopSec;
}

/** Where in the file a turn that has played `played` seconds goes on. */
export function turnOffset(track: TurnTrack, played: number): number {
  if (track.loopSec <= 0 || played <= 0) return 0;
  return track.seamless ? played % track.loopSec : Math.min(played, track.loopSec);
}

/** The first track at the launch: any of `count`, from `random` in [0, 1). */
export function firstIndex(random: () => number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
}

/** The track after `index`, round and round. */
export function nextIndex(index: number, count: number): number {
  return count <= 0 ? 0 : (index + 1) % count;
}
