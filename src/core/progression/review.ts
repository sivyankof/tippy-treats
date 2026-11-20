import type { Save } from '../save/schema';
import { REVIEW } from '../../data/app/review';
import { MS_PER_DAY } from '../../data/app/clock';

/** The rating part of the save (`review.*`). */
export type ReviewState = Save['review'];

/**
 * The game was launched or came back to the front on the local day `today`: a new day of play is
 * counted. A day that is not strictly later than the last counted one is not counted again, and
 * neither is any day while the clock looks set back.
 */
export function withPlayDay(review: ReviewState, today: string, clockBack: boolean): ReviewState {
  if (clockBack || today <= review.lastPlayDay) return review;
  return { ...review, playDays: review.playDays + 1, lastPlayDay: today };
}

/** The system rating window was asked for at `nowMs` in game version `version`. */
export function withReviewAsked(review: ReviewState, version: string, nowMs: number): ReviewState {
  return { ...review, askedVersion: version, askedAt: nowMs };
}

/** Everything the rules look at, read when the results are on the screen and their animations are over. */
export interface ReviewContext {
  review: ReviewState;
  /** The game version (`APP_VERSION`). */
  version: string;
  nowMs: number;
  /** Finished runs of the save (`stats.runs`), the run on the results included. */
  runsFinished: number;
  /** The clock looks set back. */
  clockBehind: boolean;
  /** The results are those of a daily tower run. */
  daily: boolean;
  /** The run beat the best height. */
  newRecord: boolean;
  /** The run or its results gave a creature (a level reward or one opened by the record). */
  newCreature: boolean;
  /** An interstitial is due on leaving these results (or was shown on entering them). */
  interstitialDue: boolean;
  /** A purchase or offer window is open, or the player is already leaving the results. */
  busy: boolean;
}

/**
 * The system rating request after a run (docs/04-meta-retention.md, section 10). Every condition
 * alone blocks it. A run that is neither a new record nor a new creature counts as a lost one: the
 * two triggers below already leave it out.
 */
export function canAskForReview(ctx: ReviewContext): boolean {
  const { review } = ctx;
  if (ctx.clockBehind) return false;
  if (review.playDays < REVIEW.minPlayDays || ctx.runsFinished < REVIEW.minRuns) return false;
  if (ctx.daily) return false;
  if (!ctx.newRecord && !ctx.newCreature) return false;
  if (ctx.interstitialDue || ctx.busy) return false;
  if (review.askedVersion === ctx.version) return false;
  return review.askedAt === 0 || ctx.nowMs - review.askedAt >= REVIEW.minGapDays * MS_PER_DAY;
}
