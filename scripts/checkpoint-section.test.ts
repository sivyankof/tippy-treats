import { describe, expect, it } from 'vitest';
import { judgeCheck } from './checkpoint-section';

describe('checkpoint start verdict', () => {
  it('fails a plain check past the tolerance and passes it within', () => {
    expect(judgeCheck(3.1, 'e', 'expert 20 e')).toEqual({ kind: 'fail', text: '+3.1% FAIL' });
    expect(judgeCheck(3, 'b', '')).toEqual({ kind: 'ok', text: '+3% ok' });
  });

  it('prints the run-minute checks (c) and (d) for reference at any value', () => {
    expect(judgeCheck(27.4, 'd', 'novice 60 d')).toEqual({
      kind: 'reference',
      text: '+27.4% reference',
    });
    expect(judgeCheck(-5, 'c', '')).toEqual({ kind: 'reference', text: '-5% reference' });
  });

  it('keeps an accepted advantage for reference up to 5 points past its value, then fails it', () => {
    expect(judgeCheck(19.4, 'e', 'regular 20 e')).toEqual({
      kind: 'reference',
      text: '+19.4% reference (accepted, limit +19.4%)',
    });
    expect(judgeCheck(19.5, 'e', 'regular 20 e')).toEqual({
      kind: 'fail',
      text: '+19.5% FAIL (accepted up to +19.4%)',
    });
    expect(judgeCheck(1, 'b', 'novice 20 b')).toEqual({
      kind: 'ok',
      text: '+1% ok (accepted entry no longer needed)',
    });
    // The same check of another player is judged as usual.
    expect(judgeCheck(14.4, 'e', '')).toEqual({ kind: 'fail', text: '+14.4% FAIL' });
  });
});
