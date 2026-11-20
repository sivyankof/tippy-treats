/** Limits of the analytics events and the crash reports (docs/09-services-analytics.md, sections 6 and 7). */
export const TELEMETRY = {
  /** Longest event name and parameter name Firebase accepts: 40 characters; a user property name: 24. */
  nameMax: 40,
  propertyNameMax: 24,
  /** Longest text of a parameter value (Firebase: 100) and of a user property value (36). */
  valueMax: 100,
  propertyValueMax: 36,
  /** Most parameters of one event (Firebase: 25). */
  paramsMax: 25,
  /** Name prefixes Firebase keeps for itself. */
  reservedPrefixes: ['firebase_', 'google_', 'ga_'],
  /** `currency_earn` is sent for a source that paid at least this much (not every small coin). */
  earnMin: { coins: 100, berries: 1 },
  /** Sources of credits that are never `currency_earn` events: debug grants and the berries of the run (their total is in `run_end`). */
  earnSkip: ['debug', 'run_berries'],
  /** `best_height_bucket`: the upper bound (inclusive) of every bucket but the last, and the names. */
  heightBuckets: [
    { upTo: 19, name: '0-19' },
    { upTo: 49, name: '20-49' },
    { upTo: 99, name: '50-99' },
  ],
  heightBucketLast: '100+',
  /** `install_age_bucket`: same shape, in whole days since the save was made. */
  installBuckets: [
    { upTo: 0, name: '0' },
    { upTo: 1, name: '1' },
    { upTo: 3, name: '2-3' },
    { upTo: 7, name: '4-7' },
    { upTo: 14, name: '8-14' },
    { upTo: 30, name: '15-30' },
  ],
  installBucketLast: '31+',
} as const;

/** Reports of failures to Crashlytics (non-fatal): how many and how often. */
export const CRASH = {
  /** Most reports of one page load; a loop of errors must not flood the report. */
  sessionMax: 25,
  /** Reports of one decoration (`fxGuard` name) per page load. */
  effectMax: 1,
  /** Most reports of one page load that come from decorations all together. */
  effectsTotalMax: 8,
  /** Longest message kept in a report, and the most stack frames. */
  messageMax: 300,
  stackFramesMax: 12,
  /** Messages the browser prints for harmless things; never reported. */
  ignoredMessages: ['ResizeObserver loop', 'Script error.'],
} as const;
