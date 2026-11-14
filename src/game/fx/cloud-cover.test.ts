import { describe, expect, it } from 'vitest';
import { RULE_ANIM } from '../../data/rule-anim';
import { approachShare, coverAlpha, coverRise, coverSwell, stepCover } from './cloud-cover';

const { inMs, outMs, dropOutMs } = RULE_ANIM.cloud;

describe('stepCover', () => {
  it('covers in the cover time and stays covered', () => {
    expect(stepCover(0, true, false, inMs / 2)).toBeCloseTo(0.5);
    expect(stepCover(0, true, false, inMs)).toBe(1);
    expect(stepCover(1, true, false, 1000)).toBe(1);
  });

  it('leaves in the out time, faster once the layer is dropped', () => {
    expect(stepCover(1, false, false, outMs / 2)).toBeCloseTo(0.5);
    expect(stepCover(1, false, true, dropOutMs / 2)).toBeCloseTo(0.5);
    expect(dropOutMs).toBeLessThan(outMs);
    expect(stepCover(1, false, false, outMs)).toBe(0);
  });

  it('is fully over the layer by the time the cloud has been there for inMs', () => {
    let cover = 0;
    for (let t = 0; t < inMs; t += 10) cover = stepCover(cover, true, false, 10);
    expect(cover).toBeCloseTo(1, 6);
  });
});

describe('cover look', () => {
  it('is solid and in place from the first covered frame', () => {
    const first = stepCover(0, true, false, 16);
    expect(first).toBeGreaterThan(0);
    expect(coverAlpha(first, true)).toBe(1);
    expect(coverRise(first, true)).toBe(0);
  });

  it('fades and rises only while it leaves', () => {
    expect(coverAlpha(0.5, false)).toBeCloseTo(0.5);
    expect(coverAlpha(0.1, false)).toBeLessThan(0.1);
    expect(coverRise(1, false)).toBe(0);
    expect(coverRise(0, false)).toBe(RULE_ANIM.cloud.slidePx);
  });

  it('swells from the entry size to full size', () => {
    expect(coverSwell(0)).toBe(RULE_ANIM.cloud.enterScale);
    expect(coverSwell(1)).toBe(1);
  });
});

describe('approachShare', () => {
  const { leadMs } = RULE_ANIM.cloud;

  it('floats the cloud in over the last leadMs of flight before it comes', () => {
    const speed = 600;
    const far = (speed * (leadMs + 100)) / 1000;
    expect(approachShare(far, speed, speed)).toBe(0);
    expect(approachShare((speed * leadMs) / 2000, speed, speed)).toBeCloseTo(0.5);
    expect(approachShare(0, speed, speed)).toBe(1);
  });

  it('is 0 when no cloud is due and keeps going while the layer stands still', () => {
    expect(approachShare(-1, 600, 600)).toBe(0);
    expect(approachShare(30, 0, 600)).toBeGreaterThan(0);
  });
});
