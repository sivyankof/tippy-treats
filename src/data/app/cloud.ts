// The cloud copy of the save (docs/08-architecture.md, section 5, "Облачная копия"; iCloud limits:
// docs/09-services-analytics.md, section 14).

const MINUTE_MS = 60_000;

export const CLOUD = {
  /** Keys of the cloud store: the copy, and the copy of another device it replaced (never read by the game). */
  keys: { copy: 'tippy_save', previous: 'tippy_save_prev' },
  /** Longest wait for the first cloud read; Home holds its own windows no longer than this. */
  readTimeoutMs: 3000,
  /** Cloud writes come at most this often (iCloud takes "several updates per minute"). */
  writeIntervalMs: MINUTE_MS,
  /**
   * A device that never synced writes over an empty cloud only after the store's first change
   * notification, or once its save is this old: right after an install the store is still empty.
   */
  firstWriteWaitMs: 10 * MINUTE_MS,
  /** Ids of the earlier copies a copy remembers (`lineage`), newest last. */
  lineageKeep: 50,
  /** "Almost empty" local progress (the "Progress found" window): finished runs at most. */
  almostEmptyRuns: 3,
  /** A copy text above this is not sent (the store keeps 1 MB for all keys of the app). */
  maxTextChars: 256 * 1024,
} as const;

/** Prefix of the save that lost a choice and stays on the device: `save_replaced_<time>`. */
export const REPLACED_SAVE_PREFIX = 'save_replaced_';
