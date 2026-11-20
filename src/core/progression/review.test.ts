import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../../data/app/clock';
import { REVIEW } from '../../data/app/review';
import {
  canAskForReview,
  withPlayDay,
  withReviewAsked,
  type ReviewContext,
  type ReviewState,
} from './review';

const NEVER: ReviewState = { askedVersion: '', askedAt: 0, playDays: 3, lastPlayDay: '2026-11-03' };
const NOW = 1_800_000_000_000;

/** A context where the request is due; each test spoils one condition. */
function due(over: Partial<ReviewContext> = {}): ReviewContext {
  return {
    review: NEVER,
    version: '0.1.0',
    nowMs: NOW,
    runsFinished: REVIEW.minRuns,
    clockBehind: false,
    daily: false,
    newRecord: true,
    newCreature: false,
    interstitialDue: false,
    busy: false,
    ...over,
  };
}

describe('play days', () => {
  const fresh: ReviewState = { askedVersion: '', askedAt: 0, playDays: 0, lastPlayDay: '' };

  it('counts the first day and every later one once', () => {
    const first = withPlayDay(fresh, '2026-11-01', false);
    expect(first).toMatchObject({ playDays: 1, lastPlayDay: '2026-11-01' });
    expect(withPlayDay(first, '2026-11-01', false)).toBe(first);
    expect(withPlayDay(first, '2026-11-05', false)).toMatchObject({
      playDays: 2,
      lastPlayDay: '2026-11-05',
    });
  });

  it('does not count a day that is not later, nor any day on a clock set back', () => {
    const state = { ...fresh, playDays: 2, lastPlayDay: '2026-11-05' };
    expect(withPlayDay(state, '2026-11-04', false)).toBe(state);
    expect(withPlayDay(state, '2026-11-09', true)).toBe(state);
  });
});

describe('asking for a review', () => {
  it('is due when every condition holds', () => {
    expect(canAskForReview(due())).toBe(true);
  });

  it('is also due after a new creature without a record', () => {
    expect(canAskForReview(due({ newRecord: false, newCreature: true }))).toBe(true);
  });

  it('waits for the third day of play', () => {
    expect(canAskForReview(due({ review: { ...NEVER, playDays: REVIEW.minPlayDays - 1 } }))).toBe(
      false,
    );
  });

  it('waits for ten finished runs', () => {
    expect(canAskForReview(due({ runsFinished: REVIEW.minRuns - 1 }))).toBe(false);
  });

  it('never comes after a loss: neither a record nor a new creature', () => {
    expect(canAskForReview(due({ newRecord: false, newCreature: false }))).toBe(false);
  });

  it('never comes on the results of the daily tower', () => {
    expect(canAskForReview(due({ daily: true }))).toBe(false);
    expect(canAskForReview(due({ daily: true, newRecord: false, newCreature: true }))).toBe(false);
  });

  it('stays away from an interstitial and from an open purchase or offer window', () => {
    expect(canAskForReview(due({ interstitialDue: true }))).toBe(false);
    expect(canAskForReview(due({ busy: true }))).toBe(false);
  });

  it('is blocked by a clock that looks set back', () => {
    expect(canAskForReview(due({ clockBehind: true }))).toBe(false);
  });

  it('comes once per game version', () => {
    const asked = withReviewAsked(NEVER, '0.1.0', NOW - 100 * MS_PER_DAY);
    expect(canAskForReview(due({ review: asked }))).toBe(false);
    expect(canAskForReview(due({ review: asked, version: '0.2.0' }))).toBe(true);
  });

  it('keeps a pause of 30 days even for a new version', () => {
    const gap = REVIEW.minGapDays * MS_PER_DAY;
    const asked = (ago: number): ReviewState => withReviewAsked(NEVER, '0.1.0', NOW - ago);
    expect(canAskForReview(due({ review: asked(gap - 1), version: '0.2.0' }))).toBe(false);
    expect(canAskForReview(due({ review: asked(gap), version: '0.2.0' }))).toBe(true);
  });

  it('is not due when the last request lies in the future of the clock', () => {
    const asked = withReviewAsked(NEVER, '0.1.0', NOW + MS_PER_DAY);
    expect(canAskForReview(due({ review: asked, version: '0.2.0' }))).toBe(false);
  });

  it('records the request', () => {
    expect(withReviewAsked(NEVER, '0.1.0', NOW)).toEqual({
      ...NEVER,
      askedVersion: '0.1.0',
      askedAt: NOW,
    });
  });
});
