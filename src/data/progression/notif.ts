/** The four kinds of local notification, the same keys as `settings.notifications`. */
export type NotifKind = 'gift' | 'streak' | 'daily' | 'comeback';

/** One notification the plan can hold; "come back" has two delays. */
export type NotifSlot = 'gift' | 'streak' | 'daily' | 'comeback3' | 'comeback7';

/** Local notification numbers and rules (docs/04-meta-retention.md, section 7). */
export const NOTIF = {
  /** At most this many notifications on one local day. */
  maxPerDay: 2,
  /** Quiet hours start at this local hour (inclusive) ... */
  quietFromHour: 22,
  /** ... and end at this one (exclusive); a notification inside them moves to this hour. */
  quietToHour: 9,
  /** "Streak about to end" goes out at this local hour on the same day. */
  streakHour: 19,
  /** "New daily tower" goes out at this local hour on the next day. */
  dailyHour: 10,
  /** The streak notification needs at least this streak. */
  streakMin: 2,
  /** Days without opening the game before each "come back" notification. */
  comebackDays: { comeback3: 3, comeback7: 7 },
  /** Finished runs after which the permission question is asked. */
  askAfterRuns: 3,
  /** Debug test notification: delay in milliseconds. */
  testDelayMs: 60_000,
  /** Stable id per slot (a notification with the same id replaces the old one). */
  ids: { gift: 1, streak: 2, daily: 3, comeback3: 4, comeback7: 5, test: 99 },
} as const;

/** Which settings switch governs each slot. */
export const NOTIF_KIND: Record<NotifSlot, NotifKind> = {
  gift: 'gift',
  streak: 'streak',
  daily: 'daily',
  comeback3: 'comeback',
  comeback7: 'comeback',
};

/** The order the daily cap keeps notifications in: the first ones survive. */
export const NOTIF_PRIORITY: readonly NotifSlot[] = [
  'streak',
  'gift',
  'daily',
  'comeback3',
  'comeback7',
];
