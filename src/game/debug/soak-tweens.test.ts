import { describe, expect, it } from 'vitest';
import { countLastingTweens, isLastingTween, tweenFacts, type TweenFacts } from './soak-tweens';

const H = 600;
const short: TweenFacts = { infinite: false, paused: false, remainingMs: 360 };
const infinite: TweenFacts = { infinite: true, paused: false, remainingMs: 1e9 };

describe('isLastingTween', () => {
  it('counts infinite, paused, long and unknown tweens', () => {
    expect(isLastingTween(infinite, H)).toBe(true);
    expect(isLastingTween({ ...short, paused: true }, H)).toBe(true);
    expect(isLastingTween({ ...short, remainingMs: 5000 }, H)).toBe(true);
    expect(isLastingTween({ ...short, remainingMs: null }, H)).toBe(true);
  });

  it('skips a finite tween that ends within the horizon', () => {
    expect(isLastingTween(short, H)).toBe(false);
    expect(isLastingTween({ ...short, remainingMs: H }, H)).toBe(false);
    expect(isLastingTween({ ...short, remainingMs: 0 }, H)).toBe(false);
  });
});

describe('countLastingTweens', () => {
  const home = [infinite, infinite, { ...infinite }];

  it('does not change when a short tween is caught in flight', () => {
    expect(countLastingTweens([...home, short], H)).toBe(countLastingTweens(home, H));
  });

  it('still differs when a real leak is left behind', () => {
    expect(countLastingTweens([...home, infinite], H)).toBe(4);
    expect(countLastingTweens([...home, { ...short, remainingMs: 3000 }], H)).toBe(4);
    expect(countLastingTweens([...home, { ...short, paused: true }], H)).toBe(4);
  });
});

describe('tweenFacts', () => {
  it('reads the Phaser fields', () => {
    expect(
      tweenFacts({ isInfinite: true, paused: false, totalDuration: 1, totalElapsed: 0 }),
    ).toEqual({ infinite: true, paused: false, remainingMs: 1 });
    expect(tweenFacts({ totalDuration: 420, totalElapsed: 100, countdown: 50 }).remainingMs).toBe(
      370,
    );
  });

  it('has no end for a tween without durations', () => {
    expect(tweenFacts({}).remainingMs).toBeNull();
  });
});
