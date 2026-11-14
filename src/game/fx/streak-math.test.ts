import { describe, expect, it } from 'vitest';
import { RULE_ANIM } from '../../data/rule-anim';
import { burstBoost, streakEnvelope } from './streak-math';

const { rushEnvelope, windEnvelope, burst } = RULE_ANIM.streaks;

describe('streakEnvelope', () => {
  it('is a triangle for the rush streaks: fades in, then fades out the whole rest', () => {
    expect(streakEnvelope(0, rushEnvelope)).toBe(0);
    expect(streakEnvelope(rushEnvelope.fadeInShare, rushEnvelope)).toBeCloseTo(
      1 - rushEnvelope.fadeInShare,
    );
    expect(streakEnvelope(1, rushEnvelope)).toBe(0);
  });

  it('holds the peak of the roof wind between a short fade in and a long fade out', () => {
    expect(streakEnvelope(0, windEnvelope)).toBe(0);
    expect(streakEnvelope(windEnvelope.fadeInShare, windEnvelope)).toBeCloseTo(1);
    expect(streakEnvelope(1 - windEnvelope.fadeOutShare, windEnvelope)).toBeCloseTo(1);
    expect(streakEnvelope(0.5, windEnvelope)).toBe(1);
    expect(streakEnvelope(1, windEnvelope)).toBe(0);
  });

  it('shows the wind brighter on average than the rush triangle would', () => {
    let wind = 0;
    let triangle = 0;
    for (let i = 0; i < 100; i++) {
      wind += streakEnvelope(i / 100, windEnvelope);
      triangle += streakEnvelope(i / 100, rushEnvelope);
    }
    expect(wind).toBeGreaterThan(triangle);
  });

  it('copes with runs outside of the range', () => {
    expect(streakEnvelope(-0.5, windEnvelope)).toBe(0);
    expect(streakEnvelope(1.5, windEnvelope)).toBe(0);
  });
});

describe('burstBoost', () => {
  it('is full at the release and gone after the burst time', () => {
    expect(burstBoost(0)).toBe(1);
    expect(burstBoost(burst.ms)).toBe(0);
    expect(burstBoost(burst.ms * 3)).toBe(0);
    expect(burstBoost(Infinity)).toBe(0);
  });

  it('only fades, never grows back', () => {
    let last = 1;
    for (let t = 0; t <= burst.ms; t += 20) {
      const boost = burstBoost(t);
      expect(boost).toBeLessThanOrEqual(last);
      last = boost;
    }
  });
});
