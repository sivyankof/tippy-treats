import { MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';

/** Track files in `assets/music/`, by path: their URLs in the build. */
const FILE_URLS = import.meta.glob<string>('../../../../assets/music/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** The URL of the music file `name` (a file in `assets/music/`), or null when there is none. */
export function musicFileUrl(
  name: string | undefined,
  files: Readonly<Record<string, string>> = FILE_URLS,
): string | null {
  if (!name) return null;
  return files[`../../../../assets/music/${name}`] ?? null;
}

/** The URL of a track's file, or null when the file is missing from the build. */
export function trackUrl(
  track: MusicTrackId,
  files: Readonly<Record<string, string>> = FILE_URLS,
): string | null {
  return musicFileUrl(MUSIC_TRACKS[track].file, files);
}

/** Fetches and decodes a file at the context's rate (both run off the frame). */
export function fetchAndDecode(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`music file ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data));
}
