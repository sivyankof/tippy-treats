/** Storage keys of the save (docs/09-services-analytics.md, section 2). */
export const STORAGE_KEYS = {
  save: 'save',
  backup: 'save_backup',
  /** A text that could not be read is kept under `save_corrupt_<time>` for support. */
  corruptPrefix: 'save_corrupt_',
  /** Suffix of the corrupt copy that came from `save_backup`. */
  corruptBackupSuffix: '_backup',
} as const;

/** A change reaches the storage this long after the first one of a burst. */
export const SAVE_WRITE_DEBOUNCE_MS = 500;

/** After a failed write the next try comes no sooner than this. */
export const SAVE_RETRY_MS = 5000;
