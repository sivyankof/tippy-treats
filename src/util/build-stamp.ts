/** Hash shown when git is unavailable at build time. */
export const UNKNOWN_BUILD_HASH = 'unknown';

/** Build time as `yyyy-mm-dd HH:MM UTC`, the form the settings window and the console show. */
export function formatBuildTime(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Short hash of git output, or the placeholder for empty or unusable output. */
export function cleanBuildHash(raw: string | null | undefined): string {
  const hash = (raw ?? '').trim();
  return /^[0-9a-f]{4,40}$/i.test(hash) ? hash : UNKNOWN_BUILD_HASH;
}

/** One line for the console and the error overlay: the commit and the moment of the build. */
export function formatBuildStamp(hash: string, time: string): string {
  return `${hash}, ${time}`;
}
