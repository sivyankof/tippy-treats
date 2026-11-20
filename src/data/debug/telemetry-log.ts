/** The events journal in the debug menu (services/telemetry/event-log.ts). */
export const TELEMETRY_LOG = {
  /** Lines kept in memory. */
  lines: 100,
  /** Lines the debug menu shows and copies. */
  shown: 25,
  /** The menu shows the log again this often, ms. */
  refreshMs: 1000,
} as const;
