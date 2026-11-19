/** The sound's journal and its status line in the debug menu (services/audio/audio-log.ts). */
export const AUDIO_LOG = {
  /** Lines kept in memory. */
  lines: 200,
  /** Lines the debug menu copies with the status. */
  copyLines: 30,
  /** The status line is read again this often, ms. */
  statusEveryMs: 1000,
  /** The trace build logs the status this often, ms. */
  traceEveryMs: 2000,
} as const;
