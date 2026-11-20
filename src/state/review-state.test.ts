import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../data/app/clock';
import { REVIEW } from '../data/app/review';
import { createDefaultSave } from '../core/save/defaults';
import { createTestState, loadTestState } from './test-state';

const facts = {
  daily: false,
  newRecord: true,
  newCreature: false,
  interstitialDue: false,
  busy: false,
};

describe('rating request in the state', () => {
  it('counts a day of play once per local day', () => {
    const clock = { ms: 1_700_000_000_000 };
    const state = createTestState(clock);
    state.notePlayDay();
    state.notePlayDay();
    expect(state.data.review.playDays).toBe(1);
    clock.ms += MS_PER_DAY;
    state.notePlayDay();
    expect(state.data.review.playDays).toBe(2);
  });

  it('does not count a day while the clock looks set back', () => {
    const clock = { ms: 1_700_000_000_000 };
    const state = createTestState(clock);
    state.notePlayDay();
    clock.ms -= 5 * MS_PER_DAY;
    state.notePlayDay();
    expect(state.data.review.playDays).toBe(1);
  });

  it('is not due on a new save', () => {
    expect(createTestState().canAskForReview('0.1.0', facts)).toBe(false);
  });

  it('records the request once it was made', async () => {
    const clock = { ms: 1_700_000_000_000 };
    const save = createDefaultSave(clock.ms, 'id');
    const review = { askedVersion: '', askedAt: 0, playDays: REVIEW.minPlayDays, lastPlayDay: '' };
    const state = await loadTestState(
      { ...save, review, stats: { ...save.stats, runs: REVIEW.minRuns } },
      clock,
    );
    expect(state.canAskForReview('0.1.0', facts)).toBe(true);
    state.noteReviewAsked('0.1.0');
    expect(state.data.review.askedVersion).toBe('0.1.0');
    expect(state.data.review.askedAt).toBeGreaterThan(0);
    expect(state.canAskForReview('0.1.0', facts)).toBe(false);
    expect(state.canAskForReview('0.2.0', facts)).toBe(false);
  });
});
